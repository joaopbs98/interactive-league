import { runCalibration } from "../lib/simulation/calibration.mjs";

const seasons = Math.max(1, Number(process.argv[2] || 50));
const report = runCalibration({ seasons, seed: "fc25-il-balanced-v1" });
console.log(JSON.stringify(report, null, 2));
