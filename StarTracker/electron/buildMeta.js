const fs = require("fs");
const path = require("path");

function readBuildMeta() {
  try {
    const { app } = require("electron");
    const candidates = [
      path.join(process.resourcesPath, "app.asar.unpacked", "build-meta.json"),
      path.join(app.getAppPath(), "build-meta.json"),
      path.join(__dirname, "..", "build-meta.json"),
    ];
    for (const filePath of candidates) {
      if (!filePath || !fs.existsSync(filePath)) continue;
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (raw && typeof raw === "object") return raw;
    }
  } catch {
    /* dev builds may not ship build-meta.json */
  }
  return null;
}

module.exports = { readBuildMeta };
