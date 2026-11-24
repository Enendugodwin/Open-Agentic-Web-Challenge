// Greenleaf Market: store navigation and the "AI model" section of the Developer panel.
import { CART_EVENT, summarize } from "/cart-store.js";
import {
  deleteByokProfile, getSelectedByokProfile, loadByokStore, loadTabByokSetup,
  saveTabByokSetup, selectByokProfile, upsertByokProfile,
} from "./runtime/byok.js";

// OpenAI-compatible providers. URLs and model names are starting points; edit freely.
const PRESETS = {
  site: { label: "Site default (free, no key)", url: "", model: "", keyUrl: "" },
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1", model: "nvidia/nemotron-3.5-lightning:free", keyUrl: "https://openrouter.ai/keys" },
  openai: { label: "OpenAI", url: "https://api.openai.com/v1", model: "gpt-4o-mini", keyUrl: "https://platform.openai.com/api-keys" },
  groq: { label: "Groq", url: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", keyUrl: "https://console.groq.com/keys" },
  gemini: { label: "Google Gemini (OpenAI-compatible)", url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", keyUrl: "https://aistudio.google.com/apikey" },
  custom: { label: "Custom (any OpenAI-compatible API)", url: "", model: "", keyUrl: "" },
};

export function customize({ root, runtime }) {
  addStoreNav(root);
  if (runtime?.engine) addModelSettings(root, runtime.engine);
}

function addStoreNav(root) {
  const nav = document.createElement("nav");
  nav.className = "gm-nav";
  nav.setAttribute("aria-label", "Store");
  const store = Object.assign(document.createElement("a"), { href: "/", textContent: "← Store" });
  const cart = Object.assign(document.createElement("a"), { href: "/cart.html" });
  const update = () => { cart.textContent = `Cart (${summarize().item_count})`; };
  update();
  addEventListener(CART_EVENT, update);
  addEventListener("storage", update);
  nav.append(store, cart);
  root.prepend(nav);
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return url || "?"; }
}

function presetFor(url) {
  const match = Object.entries(PRESETS).find(([id, p]) => id !== "site" && id !== "custom" && p.url && url?.replace(/\/$/, "") === p.url);
  return match ? match[0] : "custom";
}

function addModelSettings(root, engine) {
  const dev = root.querySelector(".ns-dev");
  if (!dev) return;

  const active = loadTabByokSetup(getSelectedByokProfile());
  const usingOwn = !!(engine.byokKey && engine.byokKey !== "demo");
  const activeRouter = engine.top?.llm?.baseUrl || "";
  const statusText = usingOwn
    ? `Active: your key → ${hostOf(activeRouter)}, model ${engine.modelOverride || "(network default)"}.`
    : `Active: site default model via ${hostOf(activeRouter)} (no key needed).`;

  const presetSel = el("select", { id: "gm-llm-preset" });
  for (const [id, p] of Object.entries(PRESETS)) presetSel.append(el("option", { value: id, textContent: p.label }));
  const urlIn = el("input", { id: "gm-llm-url", type: "url", placeholder: "https://provider.example/v1", autocomplete: "off", spellcheck: false });
  const modelIn = el("input", { id: "gm-llm-model", placeholder: "model name", autocomplete: "off", spellcheck: false });
  modelIn.setAttribute("list", "gm-llm-models");
  const models = el("datalist", { id: "gm-llm-models" });
  const keyIn = el("input", { id: "gm-llm-key", type: "password", placeholder: "API key", autocomplete: "off", spellcheck: false });
  const showKey = el("button", { type: "button", className: "gm-ghost", textContent: "Show" });
  const keyLink = el("a", { target: "_blank", rel: "noopener noreferrer", textContent: "" });
  const status = el("p", { className: "gm-llm-status", role: "status", textContent: statusText });
  const msg = el("p", { className: "gm-llm-msg", role: "status" });

  const testBtn = el("button", { type: "button", className: "gm-ghost", textContent: "Test connection" });
  const loadBtn = el("button", { type: "button", className: "gm-ghost", textContent: "Load models" });
  const saveBtn = el("button", { type: "button", textContent: "Save and use" });
  const resetBtn = el("button", { type: "button", className: "gm-ghost", textContent: "Use site default" });
  const forgetBtn = el("button", { type: "button", className: "gm-ghost", textContent: "Forget saved keys" });

  const field = (label, ...inputs) => el("label", { className: "gm-llm-field" }, el("span", { textContent: label }), ...inputs);
  const section = el("section", { className: "gm-llm", id: "gm-llm" },
    el("h3", { textContent: "AI model" }),
    status,
    field("Provider", presetSel),
    field("API base URL", urlIn),
    field("Model", modelIn, models),
    el("label", { className: "gm-llm-field" }, el("span", { textContent: "API key" }), el("div", { className: "gm-llm-row" }, keyIn, showKey), keyLink),
    el("div", { className: "gm-llm-actions" }, saveBtn, testBtn, loadBtn, resetBtn, forgetBtn),
    msg,
    el("p", { className: "gm-llm-note", textContent:
      "Applies to this browser only. Your key is saved in this browser and sent only to the API base URL above, never to Greenleaf Market. "
      + "The provider must allow browser requests (CORS) and use the OpenAI chat-completions format. The site owner changes the default model for everyone in Vercel (INFERENCE_* settings)." }),
  );
  dev.prepend(section);

  const setMsg = (text, kind = "") => { msg.textContent = text; msg.dataset.kind = kind; };
  const sync = () => {
    const p = PRESETS[presetSel.value];
    const own = presetSel.value !== "site";
    for (const input of [urlIn, modelIn, keyIn, showKey, testBtn, loadBtn, saveBtn]) input.disabled = !own;
    keyLink.hidden = !p.keyUrl;
    if (p.keyUrl) { keyLink.href = p.keyUrl; keyLink.textContent = `Get a ${p.label} key ↗`; }
  };

  // Start from the setup that is active now, if any.
  if (usingOwn && active.router) {
    presetSel.value = presetFor(active.router);
    urlIn.value = active.router;
    modelIn.value = active.model || "";
    keyIn.value = active.key || "";
  } else {
    presetSel.value = "site";
  }
  sync();

  presetSel.addEventListener("change", () => {
    const p = PRESETS[presetSel.value];
    if (presetSel.value !== "custom" && presetSel.value !== "site") { urlIn.value = p.url; modelIn.value = p.model; }
    sync();
    setMsg("");
  });
  showKey.addEventListener("click", () => {
    keyIn.type = keyIn.type === "password" ? "text" : "password";
    showKey.textContent = keyIn.type === "password" ? "Show" : "Hide";
  });

  const read = () => {
    const url = urlIn.value.trim().replace(/\/$/, "");
    const model = modelIn.value.trim();
    const key = keyIn.value.trim();
    let parsed;
    try { parsed = new URL(url); } catch { return { error: "Enter a valid API base URL, for example https://openrouter.ai/api/v1." }; }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(loopback && location.protocol === "http:")) return { error: "The API base URL must use https." };
    if (parsed.origin === location.origin) return { error: "Use the site default instead of pointing at this site." };
    if (!model) return { error: "Enter a model name." };
    if (!key) return { error: "Enter your API key." };
    return { url, model, key };
  };

  testBtn.addEventListener("click", async () => {
    const v = read();
    if (v.error) return setMsg(v.error, "warn");
    setMsg(`Testing ${hostOf(v.url)}…`);
    try {
      const resp = await fetch(`${v.url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${v.key}` },
        body: JSON.stringify({ model: v.model, max_tokens: 20, messages: [{ role: "user", content: "Reply with the word OK." }] }),
        signal: AbortSignal.timeout(30000),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) return setMsg(`The provider answered HTTP ${resp.status}: ${String(body?.error?.message || "request failed").slice(0, 160)}`, "warn");
      setMsg(`Works: ${body.model || v.model} answered. Select "Save and use" to switch.`, "ok");
    } catch (err) {
      setMsg(`Could not reach ${hostOf(v.url)} from the browser (${err.name === "TimeoutError" ? "timed out" : "network or CORS error"}). This provider may not allow browser requests.`, "warn");
    }
  });

  loadBtn.addEventListener("click", async () => {
    const url = urlIn.value.trim().replace(/\/$/, "");
    const key = keyIn.value.trim();
    if (!url) return setMsg("Enter the API base URL first.", "warn");
    setMsg(`Loading models from ${hostOf(url)}…`);
    try {
      const resp = await fetch(`${url}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(30000) });
      const body = await resp.json();
      const ids = (body.data || body.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
      models.replaceChildren(...ids.slice(0, 500).map((id) => el("option", { value: id })));
      setMsg(ids.length ? `${ids.length} models loaded. Start typing in the Model field to pick one.` : "The provider returned no models.", ids.length ? "ok" : "warn");
    } catch {
      setMsg(`Could not load models from ${hostOf(url)}. You can still type a model name.`, "warn");
    }
  });

  saveBtn.addEventListener("click", () => {
    const v = read();
    if (v.error) return setMsg(v.error, "warn");
    const { profile } = upsertByokProfile({ name: `${PRESETS[presetSel.value].label}: ${v.model}`.slice(0, 80), key: v.key, router: v.url, model: v.model });
    saveTabByokSetup({ key: v.key, router: v.url, model: v.model });
    setMsg(`Saved "${profile?.name || v.model}". Reloading…`, "ok");
    setTimeout(() => location.reload(), 400);
  });

  resetBtn.addEventListener("click", () => {
    selectByokProfile(""); // keep saved setups, but stop using them
    saveTabByokSetup(null);
    setMsg("Switching back to the site default model. Reloading…", "ok");
    setTimeout(() => location.reload(), 400);
  });

  forgetBtn.addEventListener("click", () => {
    for (const p of loadByokStore().profiles) deleteByokProfile(p.id);
    saveTabByokSetup(null);
    setMsg("Saved keys removed from this browser. Reloading…", "ok");
    setTimeout(() => location.reload(), 400);
  });
}
