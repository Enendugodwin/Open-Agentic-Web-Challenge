#!/usr/bin/env node
// Build the published agent artifacts for one deployment origin.
//
//   node scripts/build-agents.mjs --site-url https://greenleaf-market.vercel.app [--out DIR]
//
// 1. Substitute __SITE_ORIGIN__ in agents/*.hocon (so the published JSON is fully
//    resolved, spec §2).
// 2. Run the pinned nsDeploy (vendor/nsdeploy) to produce a static bundle under
//    <out> (default apps/site/public/agents), using the patched runtime in
//    packages/runtime.
// 3. Point the manifest's llm_router at the site-funded proxy and lint the output.
//
// Requires Python 3.10+ with vendor/nsdeploy/requirements.txt installed. Set
// PYTHON to choose the interpreter (default: .venv, then "python").

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NETWORK = "market_assistant";

function parseArgs(argv) {
  const args = { out: path.join(root, "apps/site/public/agents") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--site-url") args.siteUrl = argv[++i];
    else if (argv[i] === "--out") args.out = path.resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.siteUrl) throw new Error("--site-url is required (e.g. https://greenleaf-market.vercel.app)");
  const url = new URL(args.siteUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new Error("--site-url must be https (http is allowed only for loopback development)");
  }
  if (url.pathname !== "/" || url.search || url.hash) throw new Error("--site-url must be a bare origin");
  args.origin = url.origin;
  return args;
}

function pythonCmd() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const venv = process.platform === "win32"
    ? path.join(root, ".venv/Scripts/python.exe")
    : path.join(root, ".venv/bin/python");
  return existsSync(venv) ? venv : "python";
}

function lint(out, origin) {
  const problems = [];
  const manifest = JSON.parse(readFileSync(path.join(out, "agent-manifest.json"), "utf8"));
  const entry = manifest.networks?.find((n) => n.name === NETWORK);
  if (!entry) problems.push(`manifest has no network named ${NETWORK}`);
  if (!entry?.front_man) problems.push("manifest entry has no front_man");
  const networkFile = path.join(out, entry?.hocon || "missing");
  if (!existsSync(networkFile)) problems.push(`network file ${entry?.hocon} missing`);
  else {
    const text = readFileSync(networkFile, "utf8");
    JSON.parse(text);
    for (const bad of ["${", "__SITE_ORIGIN__", "include \"", "include("]) {
      if (text.includes(bad)) problems.push(`network JSON contains unresolved "${bad}"`);
    }
    if (!text.includes(`${origin}/api/mcp/public`)) problems.push("network JSON does not reference this origin's MCP server");
  }
  JSON.parse(readFileSync(path.join(out, "links.json"), "utf8"));
  if (manifest.actions?.module !== "./actions.js" || !existsSync(path.join(out, "actions.js"))) {
    problems.push("site action module (actions.js) missing from the manifest or bundle");
  }
  // Published artifacts must never carry secrets.
  const secretPattern = /(sk-[A-Za-z0-9_-]{16,}|swa_(at|rt)_[A-Za-z0-9]+|Bearer\s+[A-Za-z0-9._-]{12,})/;
  for (const file of ["agent-manifest.json", entry?.hocon, "links.json"].filter(Boolean)) {
    if (secretPattern.test(readFileSync(path.join(out, file), "utf8"))) problems.push(`${file} looks like it contains a credential`);
  }
  return problems;
}

function main() {
  const { siteUrl, origin, out } = parseArgs(process.argv.slice(2));
  const work = path.join(root, ".build");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const source = readFileSync(path.join(root, "agents", `${NETWORK}.hocon`), "utf8");
  const hoconPath = path.join(work, `${NETWORK}.hocon`);
  writeFileSync(hoconPath, source.replaceAll("__SITE_ORIGIN__", origin));

  rmSync(out, { recursive: true, force: true });
  const nsdeploy = path.join(root, "vendor/nsdeploy");
  const result = spawnSync(pythonCmd(), [
    "-m", "nsdeploy", hoconPath,
    "--static-bundle",
    "--out", out,
    "--site-url", `${origin}/agents`,
    "--site-dir", path.join(root, "agents/sites", NETWORK),
    "--runtime-dir", path.join(root, "packages/runtime"),
  ], {
    cwd: nsdeploy,
    stdio: "inherit",
    env: { ...process.env, PYTHONPATH: nsdeploy, PYTHONIOENCODING: "utf-8" },
  });
  if (result.status !== 0) throw new Error(`nsdeploy exited with ${result.status ?? result.error}`);

  // Manifest: publisher-funded default router on this origin (spec §4 "Default
  // inference"); no BYOK route is offered in the MVP.
  const manifestPath = path.join(out, "agent-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.brand = "Greenleaf Market shopping assistant";
  manifest.llm_router = {
    base_url: `${origin}/api/infer/v1`,
    mock: false,
    site_funded: true,
    byok_router: "",
    note: "Publisher-funded default router for this site's own runtime. Informational for peers: a caller always uses its own router.",
  };
  manifest.deployment = { ...(manifest.deployment || {}), direct_byok: false, site_funded_inference: true };
  manifest.mcp = [{ url: `${origin}/api/mcp/public`, tools: ["match_ingredients", "search_products"], auth: "none", effect: "read" }];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  // Vercel serves headers from vercel.json; drop the generic host files.
  for (const f of ["_headers", ".htaccess", "STATIC_HOSTING.md"]) rmSync(path.join(out, f), { force: true });

  // CSP: the site allows only same-origin script files (script-src 'self'), so move
  // the generated inline boot module into boot.js.
  const indexPath = path.join(out, "index.html");
  const html = readFileSync(indexPath, "utf8");
  const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!inline) throw new Error("generated index.html has no inline boot module");
  writeFileSync(path.join(out, "boot.js"), inline[1].replace(/^\n/, "").replace(/^ {4}/gm, ""));
  writeFileSync(indexPath, html.replace(inline[0], '<script type="module" src="./boot.js"></script>'));
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(readFileSync(indexPath, "utf8"))) throw new Error("index.html still has an inline script");

  const problems = lint(out, origin);
  if (problems.length) {
    for (const p of problems) console.error(`✖ ${p}`);
    process.exit(1);
  }
  console.log(`✔ agent artifacts for ${siteUrl} written to ${path.relative(root, out)} (${readdirSync(out).length} entries)`);
}

try {
  main();
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}
