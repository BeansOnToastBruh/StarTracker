const assert = require("assert");
const { parseLine } = require("../electron/parser");

const ctx = { playerNick: "BeansOnToastBruh" };

const qtLine =
  `<2026-07-27T06:22:37.999Z> [Notice] <Quantum Drive Arrived - Arrived at Final Destination> [ItemNavigation][CL][7804] | NOT AUTH | GAMA_Railen_738956821393[738956821393]|CSCItemNavigation::OnQuantumDriveArrived|Quantum Drive has arrived at final destination [Team_CGP4][QuantumTravel]`;

const qt = parseLine(qtLine, ctx);
assert.strictEqual(qt?.type, "travel");
assert.strictEqual(qt.detail?.source, "quantum_arrived");
assert.strictEqual(qt.detail?.shipClass, "GAMA_Railen");
assert.ok(/QT arrived/i.test(qt.summary));

const oldQt =
  `<2026-05-01T12:00:00.000Z> [Notice] Transitioning from zone PortOlisar in Stanton to zone Area18 in Stanton`;
const legacy = parseLine(oldQt, ctx);
assert.strictEqual(legacy?.type, "travel");
assert.strictEqual(legacy.detail?.source, "zone_transition");

const withdrawn =
  `<2026-07-27T06:40:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "Objective Withdrawn: Return to a Hurston Weapons Testing Site above Aberdeen: " [145] MissionId: [9b95025b-728f-4255-b69b-00dc96d7571e]`;
const w = parseLine(withdrawn, ctx);
assert.strictEqual(w?.type, "contract_objective");
assert.strictEqual(w.detail?.action, "withdrawn");
assert.ok(/Hurston/i.test(w.detail?.title || ""));

console.log("test-quantum-49: OK");
