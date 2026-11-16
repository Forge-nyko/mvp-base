import {spawnSync} from "node:child_process";
for (let run = 1; run <= 20; run++) {
  const result = spawnSync(process.execPath, ["scripts/veterinary-patient-persistence-smoke.mjs"], {stdio: "inherit", env: process.env});
  console.log(`CONCURRENCY_RUN ${run}/20 exit=${result.status}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("CONCURRENCY_20_OF_20_OK");
