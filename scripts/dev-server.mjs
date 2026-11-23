#!/usr/bin/env node
// Local stand-in for Vercel: serves apps/site/public, applies vercel.json headers and
// redirects, and routes /api/** to Web-signature handlers (export function POST(req)).
//
//   node scripts/dev-server.mjs [--port 3000] [--agents-dir DIR]
//
// --agents-dir serves a different /agents/ bundle (e.g. one built for this port).
// This is a development aid, not a production server.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "apps/site");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};

// vercel.json "source" patterns here use path-to-regexp groups only, which are
// valid regular expressions once anchored.
const toRegex = (source) => new RegExp(`^${source}$`);

export async function startDevServer({ port = 3000, host = "127.0.0.1", agentsDir, allowHttpPeers = true } = {}) {
  const vercel = JSON.parse(readFileSync(path.join(siteDir, "vercel.json"), "utf8"));
  const publicDir = path.join(siteDir, vercel.outputDirectory || "public");
  const headerRules = (vercel.headers || []).map((r) => ({ re: toRegex(r.source), headers: r.headers }));
  const redirects = (vercel.redirects || []).map((r) => ({ re: toRegex(r.source), ...r }));
  const rewrites = (vercel.rewrites || []).map((r) => ({ re: toRegex(r.source), ...r }));

  const headersFor = (pathname) => {
    const out = {};
    for (const rule of headerRules) {
      if (!rule.re.test(pathname)) continue;
      for (const { key, value } of rule.headers) out[key.toLowerCase()] = value; // later rules win
    }
    delete out["strict-transport-security"]; // meaningless over local http
    if (allowHttpPeers && out["content-security-policy"]) {
      // Local peers run on http://127.0.0.1:<port>; production stays https-only.
      out["content-security-policy"] = out["content-security-policy"].replace("connect-src 'self' https:", "connect-src 'self' https: http://127.0.0.1:* http://localhost:*");
    }
    return out;
  };

  const handlerCache = new Map();
  async function apiHandler(pathname) {
    const rel = pathname.replace(/^\/api\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9/_-]+$/i.test(rel) || rel.includes("..")) return null;
    const file = path.join(siteDir, "api", `${rel}.js`);
    if (!existsSync(file)) return null;
    if (!handlerCache.has(file)) handlerCache.set(file, await import(pathToFileURL(file).href));
    return handlerCache.get(file);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
    const headerPath = decodeURIComponent(url.pathname); // headers match the requested path, as on Vercel
    for (const r of rewrites) {
      if (r.re.test(headerPath)) {
        const dest = new URL(r.destination, url);
        url.pathname = dest.pathname;
        dest.searchParams.forEach((v, k) => url.searchParams.set(k, v));
        break;
      }
    }
    const pathname = decodeURIComponent(url.pathname);
    try {
      for (const r of redirects) {
        if (r.re.test(pathname)) {
          res.writeHead(r.permanent ? 308 : 307, { Location: r.destination });
          return res.end();
        }
      }
      if (pathname.startsWith("/api/")) {
        const mod = await apiHandler(pathname);
        const fn = mod?.[req.method];
        if (!mod) { res.writeHead(404, { "content-type": "application/json" }); return res.end('{"error":"not_found"}'); }
        if (!fn) { res.writeHead(405, { "content-type": "application/json" }); return res.end('{"error":"method_not_allowed"}'); }
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
        const controller = new AbortController();
        res.on("close", () => { if (!res.writableFinished) controller.abort(); });
        const hasBody = !["GET", "HEAD"].includes(req.method);
        const request = new Request(url, {
          method: req.method, headers, signal: controller.signal,
          body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? "half" : undefined,
        });
        const response = await fn(request);
        const out = { ...headersFor(headerPath) };
        response.headers.forEach((v, k) => { out[k] = v; });
        res.writeHead(response.status, out);
        if (response.body && req.method !== "HEAD") {
          for await (const chunk of response.body) res.write(chunk);
        }
        return res.end();
      }

      let file = path.join(publicDir, pathname);
      if (agentsDir && pathname.startsWith("/agents/")) file = path.join(agentsDir, pathname.slice("/agents/".length));
      const base = agentsDir && pathname.startsWith("/agents/") ? agentsDir : publicDir;
      if (!path.resolve(file).startsWith(path.resolve(base))) { res.writeHead(403); return res.end(); }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) { file = path.join(file, "index.html"); info = await stat(file).catch(() => null); }
      if (!info) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", ...headersFor(pathname) });
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch (err) {
      console.error(`dev-server: ${req.method} ${pathname}: ${err.stack || err}`);
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end('{"error":"internal_error"}');
    }
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
  return { server, url: `http://${host}:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const { url } = await startDevServer({ port: Number(get("--port") || 3000), agentsDir: get("--agents-dir") && path.resolve(get("--agents-dir")) });
  console.log(`dev server on ${url}`);
}
