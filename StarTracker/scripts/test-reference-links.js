const assert = require("assert");
const referenceLinks = require("../electron/referenceLinks");

const itemLinks = referenceLinks.buildItemLinks({
  name: "P4-AR",
  className: "ksar_p4ar",
});
assert.ok(itemLinks.some((l) => l.id === "scodex"));
assert.ok(itemLinks.some((l) => l.id === "scunpacked"));

const locLinks = referenceLinks.buildLocationLinks({
  name: "Grim HEX",
  uuid: "8cda0b9b-22a8-43fe-ac33-df7a1ba9434d",
});
assert.ok(locLinks.some((l) => l.id === "rsi-starmap" && l.url.includes("8cda0b9b")));

console.log("test-reference-links: OK");
