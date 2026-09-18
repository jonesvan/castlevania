import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDataset, buildStats } from "./cv3.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const entries = buildDataset();
const stats = buildStats(entries);

const outDir = resolve(__dirname, "..", "data");
await mkdir(outDir, { recursive: true });
await writeFile(
  resolve(outDir, "passwords.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), stats, entries })
);

console.log(`Generated ${entries.length} passwords -> data/passwords.json`);
