/** Stub `server-only` so tsx scripts can import server modules. */
const Module = require("module");
const originalLoad = Module._load;
Module._load = function mockServerOnly(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
