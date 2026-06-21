const assert = require("assert");
const {
  parsePatchNotesText,
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
  assert.ok(
    normalizeRsiUrl("https://robertsspaceindustries.com/en/comm-link/transmission/21215-Star-Citizen-Live", 21215).includes(
      "Patch-Notes"
    ),
    "SCL url rewritten"
  );

  console.log("test-patch-notes-format: OK");
}

main();
