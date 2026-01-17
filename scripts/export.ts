import { exportToCSV, showStats } from "../src/exporter.js";

const args = process.argv.slice(2);

if (args[0] === "--stats") {
  showStats();
} else {
  const outputPath = args[0];
  exportToCSV(outputPath);
}
