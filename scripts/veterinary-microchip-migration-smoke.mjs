import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {migrateVeterinaryMicrochips} from "./migrate-veterinary-microchips.mjs";
if (!process.env.GCLOUD_PROJECT?.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Local demo emulator required");
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const admin = require("firebase-admin");
const app = admin.initializeApp({projectId: process.env.GCLOUD_PROJECT});
const db = admin.firestore();
try {
  const businessId = "migration-" + randomUUID();
  const business = db.doc("negocios/" + businessId);
  const patients = business.collection("pacientesVeterinarios");
  const chips = business.collection("microchipsVeterinarios");
  for (const [id, microchip] of [["old", "00-ab"], ["dup1", "01-cd"], ["dup2", "01 CD"], ["conflict", "02-ef"]]) {
    await patients.doc(id).set({negocioId: businessId, microchip});
  }
  await chips.doc("02EF").set({pacienteId: "someone-else"});
  const dry = await migrateVeterinaryMicrochips(db, businessId);
  assert.equal(dry.find((row) => row.chip === "00AB").status, "would-normalize-and-reserve");
  assert.deepEqual(dry.find((row) => row.status === "duplicate").patientIds, ["dup1", "dup2"]);
  assert.equal((await patients.doc("old").get()).get("microchip"), "00-ab");
  assert.equal((await chips.get()).size, 1);
  const result = await migrateVeterinaryMicrochips(db, businessId, {apply: true});
  assert.equal(result.find((row) => row.chip === "00AB").status, "applied");
  assert.equal(result.find((row) => row.chip === "02EF").status, "reservation-conflict");
  assert.equal((await chips.doc("00AB").get()).get("pacienteId"), "old");
  assert.equal((await patients.doc("old").get()).get("microchip"), "00AB");
  assert.equal((await chips.doc("01CD").get()).exists, false);
  assert.equal((await patients.doc("dup1").get()).get("microchip"), "01-cd");
  const before = (await patients.get()).docs.map((doc) => doc.data());
  assert.equal((await migrateVeterinaryMicrochips(db, businessId, {apply: true})).find((row) => row.chip === "00AB").status, "unchanged");
  assert.deepEqual((await patients.get()).docs.map((doc) => doc.data()), before);
  assert.equal((await chips.get()).size, 2);
  console.log("VETERINARY_MICROCHIP_MIGRATION_SMOKE_OK");
} finally { await app.delete(); }
