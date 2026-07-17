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

load();
