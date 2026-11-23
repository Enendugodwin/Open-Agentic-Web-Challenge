
import { boot } from "./runtime/index.js";
const siteBase = new URL("./", window.location.href).href;
boot("#app", {
  originUrl: siteBase,
  sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
}).then(async (runtime) => {
  try {
    const site = await import("./site.js");
    await site.customize?.({ root: document.querySelector("#app"), runtime });
  } catch (e) {
    console.error("Site customization error", e);
  }
}).catch((e) => {
  const a = document.querySelector("#app"); if (a) a.textContent = "Boot error: " + e.message;
  console.error(e);
});
  