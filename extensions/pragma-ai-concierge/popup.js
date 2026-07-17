const fields = ["apiBase", "secret", "orgId", "userId", "mode"];

async function load() {
  const cfg = await chrome.storage.sync.get({
    apiBase: "http://127.0.0.1:3000",
    secret: "",
    orgId: "",
    userId: "",
    mode: "manual",
  });
  for (const key of fields) {
    const el = document.getElementById(key);
    if (el) el.value = cfg[key] ?? "";
  }
}

document.getElementById("save")?.addEventListener("click", async () => {
  const payload = {};
  for (const key of fields) {
    payload[key] = document.getElementById(key)?.value?.trim() || "";
  }
  await chrome.storage.sync.set(payload);
  window.close();
});

document.getElementById("health")?.addEventListener("click", async () => {
  const out = document.getElementById("healthOut");
  try {
    const res = await chrome.runtime.sendMessage({
      type: "CONCIERGE_HEALTH",
      payload: {},
    });
    if (out) {
      out.textContent = res?.ok
        ? `Conectado · HTTP ${res.status} · mode header OK`
        : `Sin conexión · ${res?.data?.error || res?.status || "fail"}`;
    }
  } catch (err) {
    if (out) out.textContent = `Error: ${String(err)}`;
  }
});

load();
