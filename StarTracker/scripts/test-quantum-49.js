const assert = require("assert");
const { parseLine } = require("../electron/parser");
const { createVehicleCtx } = require("../electron/vehicleContext");

function makeCtx(extra = {}) {
  return {
    playerNick: "BeansOnToastBruh",
    playerGEID: "204771992619",
    ownedVehicleIds: new Map(),
    lastPilotedVehicle: null,
    ...createVehicleCtx(),
    ...extra,
  };
}

const railenId = "738956821393";
const moleId = "722929375237";

const qtRailen =
  `<2026-07-27T06:22:37.999Z> [Notice] <Quantum Drive Arrived - Arrived at Final Destination> [ItemNavigation][CL][7804] | NOT AUTH | GAMA_Railen_${railenId}[${railenId}]|CSCItemNavigation::OnQuantumDriveArrived|Quantum Drive has arrived at final destination [Team_CGP4][QuantumTravel]`;

const qtMole =
  `<2026-07-27T08:20:00.000Z> [Notice] <Quantum Drive Arrived - Arrived at Final Destination> [ItemNavigation][CL][7804] | NOT AUTH | ARGO_MOLE_${moleId}[${moleId}]|CSCItemNavigation::OnQuantumDriveArrived|Quantum Drive has arrived at final destination [Team_CGP4][QuantumTravel]`;

// Passenger MOLE QT should be ignored when never piloted.
{
  const ctx = makeCtx();
  const ev = parseLine(qtMole, ctx);
  assert.ok(!ev || (Array.isArray(ev) ? !ev.some((e) => e.type === "travel") : ev.type !== "travel"));
}

// Local Railen QT counts when already owned.
{
  const ctx = makeCtx();
  ctx.ownedVehicleIds.set(railenId, { name: `GAMA_Railen_${railenId}`, reason: "control_token" });
  const ev = parseLine(qtRailen, ctx);
  const travel = Array.isArray(ev) ? ev.find((e) => e.type === "travel") : ev;
  assert.strictEqual(travel?.type, "travel");
  assert.strictEqual(travel.detail?.shipClass, "GAMA_Railen");
}

// Location visit
{
  const ctx = makeCtx();
  const line =
    `<2026-07-27T05:59:20.183Z> [Notice] <RequestLocationInventory> Player[BeansOnToastBruh] requested inventory for Location[RR_P6_LEO] [Team_CoreGameplayFeatures][Inventory]`;
  const ev = parseLine(line, ctx);
  const loc = Array.isArray(ev) ? ev.find((e) => e.type === "location") : ev;
  assert.strictEqual(loc?.type, "location");
  assert.ok(/Rest & Relax/i.test(loc.detail.location));
}

// Mission org accept enriches wiki meta for later Contract Accepted
{
  const ctx = makeCtx();
  const orgLine =
    `<2026-07-27T06:37:04.537Z> [Notice] <CommsNotifications> SendCommsNotification +Missions.Organization.FoxwellEnforcement.Walton,Missions.Organization.FoxwellEnforcement,Missions.MissionType.Generic,Missions.CommsNotifications.MissionAccept - [f67787b4-b05a-400d-8276-ba50b6d6b644] - Mission: [9b95025b-728f-4255-b69b-00dc96d7571e], Player: BeansOnToastBruh[204771992619] [Team_MissionFeatures][Missions]`;
  parseLine(orgLine, ctx);
  const meta = ctx.missionWikiByMissionId.get("9b95025b-728f-4255-b69b-00dc96d7571e");
  assert.strictEqual(meta.organization, "FoxwellEnforcement");
  assert.strictEqual(meta.missionType, "Generic");
}

// Party join
{
  const ctx = makeCtx();
  const line =
    `<2026-07-27T07:02:46.251Z> [Notice] <Accept invitation> Client 204771992619 accept invitation be85d37c-696f-4774-bfbf-475af5e2fba1 [Team_GameServices][Social]`;
  const ev = parseLine(line, ctx);
  const party = Array.isArray(ev) ? ev.find((e) => e.type === "party") : ev;
  assert.strictEqual(party?.type, "party");
  assert.strictEqual(party.detail.action, "joined");
}

// Objective withdrawn (regression)
{
  const ctx = makeCtx();
  const withdrawn =
    `<2026-07-27T06:40:00.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "Objective Withdrawn: Return to a Hurston Weapons Testing Site above Aberdeen: " [145] MissionId: [9b95025b-728f-4255-b69b-00dc96d7571e]`;
  const w = parseLine(withdrawn, ctx);
  const obj = Array.isArray(w) ? w.find((e) => e.type === "contract_objective") : w;
  assert.strictEqual(obj?.detail?.action, "withdrawn");
}

console.log("test-quantum-49: OK");
