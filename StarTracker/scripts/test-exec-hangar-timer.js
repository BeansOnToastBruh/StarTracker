const assert = require("assert");
const path = require("path");
const os = require("os");
const fs = require("fs");
const execHangarTimer = require("../electron/execHangarTimer");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "st-exec-"));
const seedDir = path.join(__dirname, "..", "data", "guides");

execHangarTimer.init({ seedDir, cacheDir: tmp });

function colorsEqual(a, b) {
  assert.deepStrictEqual(a, b);
}

function main() {
  const openMs = 65 * 60 * 1000;
  // Online: full green → empty
  colorsEqual(execHangarTimer.lightsForTimeInCycle(0, openMs), [
    "green",
    "green",
    "green",
    "green",
    "green",
  ]);
  colorsEqual(execHangarTimer.lightsForTimeInCycle(12 * 60 * 1000, openMs), [
    "green",
    "green",
    "green",
    "green",
    "empty",
  ]);
  colorsEqual(execHangarTimer.lightsForTimeInCycle(48 * 60 * 1000, openMs), [
    "green",
    "empty",
    "empty",
    "empty",
    "empty",
  ]);
  colorsEqual(execHangarTimer.lightsForTimeInCycle(60 * 60 * 1000, openMs), [
    "empty",
    "empty",
    "empty",
    "empty",
    "empty",
  ]);

  // Charging: all red → greens fill in
  colorsEqual(execHangarTimer.lightsForTimeInCycle(openMs, openMs), [
    "red",
    "red",
    "red",
    "red",
    "red",
  ]);
  colorsEqual(
    execHangarTimer.lightsForTimeInCycle(openMs + 24 * 60 * 1000, openMs),
    ["green", "red", "red", "red", "red"]
  );
  colorsEqual(
    execHangarTimer.lightsForTimeInCycle(openMs + 96 * 60 * 1000, openMs),
    ["green", "green", "green", "green", "red"]
  );

  const cfg = execHangarTimer.loadConfig();
  assert.ok(cfg.ok, "seed config should load");
  assert.ok(cfg.initialOpenTime);

  const epoch = new Date(cfg.initialOpenTime).getTime();
  const openStatus = execHangarTimer.getStatus(epoch + 1000);
  assert.strictEqual(openStatus.status, "ONLINE");
  assert.strictEqual(openStatus.phase.id, "open");
  assert.strictEqual(openStatus.phase.canInsert, true);
  assert.ok(openStatus.lights.every((c) => c === "green"));

  const chargingStatus = execHangarTimer.getStatus(epoch + cfg.openDurationMs + 1000);
  assert.strictEqual(chargingStatus.status, "OFFLINE");
  assert.strictEqual(chargingStatus.phase.id, "charging");
  assert.strictEqual(chargingStatus.phase.canInsert, false);
  assert.ok(chargingStatus.lights.includes("red"));

  const resetStatus = execHangarTimer.getStatus(epoch + 61 * 60 * 1000);
  assert.strictEqual(resetStatus.phase.id, "reset");
  assert.ok(resetStatus.lights.every((c) => c === "empty"));

  execHangarTimer.setUserOffsetMs(60000);
  const nudged = execHangarTimer.getStatus(epoch);
  // +1m offset moves slightly into cycle from epoch perspective
  assert.strictEqual(nudged.offsetMs, 60000);
  execHangarTimer.setUserOffsetMs(0);

  assert.ok(execHangarTimer.formatDuration(65 * 60 * 1000).includes("1:05") || execHangarTimer.formatDuration(65 * 60 * 1000) === "1:05:00");

  console.log("test-exec-hangar-timer: OK");
}

main();
