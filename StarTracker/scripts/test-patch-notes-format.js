const assert = require("assert");
const {
  parsePatchNotesText,
  splitPatchDocument,
  isPatchNotesBody,
  comparePatchVersions,
  normalizeRsiUrl,
} = require("../electron/patchNotesFormat");

function main() {
  const sample = `May 13th, 2026
Star Citizen Alpha 4.8 LIVE
Star Citizen Alpha 4.8 has been released onto the LIVE environment!

Build Information
Special Note: LTP wipe while preserving blueprints.

Features and Gameplay
1. Gameplay: Tactical Strike Group
Tactical Strike Group is a new endgame contract.

Bug Fixes & Technical Updates
Client Crash Fixes: 17 fixes

Inventory
Fixed an issue where hovering over equipment slots did not highlight items.
Fixed an issue where items dragged into equipment slots would fail to equip.

Known Issues & Information
Known Issues
Some missions may fail to progress.`;

  const rsiStack = `Star Citizen Alpha 4.8.2 LIVE
June 17th, 2026
Update
Build Update: VERSION 4.8.2-LIVE.12030094
Features & Updates
Star Citizen Alpha 4.8.2 has been released to the LIVE servers and introduces new ships and many bugfixes.
EXPAND ALL / COLLAPSE ALL
4.8.2: Bugfixes & Technical
Star Citizen Alpha 4.8.1 LIVE
June 3rd, 2026
Update
Content & Feature Updates: Defend Location Missions
Star Citizen Alpha 4.8 LIVE
May 13th, 2026
Build Information
Bug Fixes & Technical Updates
Inventory
Fixed an issue where hovering over equipment slots did not highlight items.`;

  const parsed = parsePatchNotesText(sample);
  assert.ok(parsed.headline.includes("Alpha 4.8"), "headline");
  assert.ok(parsed.sections.length >= 3, "expected major sections");
  const features = parsed.sections.find((s) => /Features/i.test(s.title));
  assert.ok(features, "features section");
  const bugs = parsed.sections.find((s) => /Bug Fixes/i.test(s.title));
  assert.ok(bugs?.subsections?.some((s) => s.title === "Inventory"), "inventory subsection");
  assert.ok(
    bugs.subsections.find((s) => s.title === "Inventory").items.some((i) => /hovering over equipment/i.test(i)),
    "bug item"
  );

  assert.strictEqual(
    normalizeRsiUrl("https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21168-Star-Citizen-Alpha-48"),
    "https://robertsspaceindustries.com/en/comm-link/Patch-Notes/21168-Star-Citizen-Alpha-48"
  );
  assert.strictEqual(
    normalizeRsiUrl(
      "https://robertsspaceindustries.com/en/comm-link/transmission/21215-Star-Citizen-Live",
      21215,
      "Star Citizen Live"
    ),
    null,
    "SCL url must not become Patch-Notes"
  );

  const splits = splitPatchDocument(rsiStack);
  assert.strictEqual(splits.length, 3, "split stacked RSI Alpha 4.8 page");
  assert.strictEqual(splits[0].version, "4.8.2");
  assert.strictEqual(splits[1].version, "4.8.1");
  assert.strictEqual(splits[2].version, "4.8");
  assert.strictEqual(splits[0].dateHuman, "June 17th, 2026");
  assert.ok(isPatchNotesBody(sample), "wiki-style patch body");
  assert.ok(!isPatchNotesBody("DEFENDERS NEEDED\nALPHA 4.8.1\nMore ship battle contracts"), "marketing body rejected");
  assert.ok(comparePatchVersions("4.8.2", "4.8.1") < 0, "newer patch sorts first");

  console.log("test-patch-notes-format: OK");
}

main();
