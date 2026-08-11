import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSVG } from "uqr";
import { SUPPORT_TIERS, supportQrPath } from "../lib/support-tiers.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "public/qr");
const expectedFiles = new Set<string>();

await mkdir(outputDirectory, { recursive: true });

for (const tier of SUPPORT_TIERS) {
  const filename = basename(supportQrPath(tier));
  expectedFiles.add(filename);

  const svg = renderSVG(tier.url, {
    ecc: "M",
    boostEcc: true,
    border: 4,
    pixelSize: 1,
    blackColor: "#101014",
    whiteColor: "#ffffff",
  }).replace("<svg ", '<svg shape-rendering="crispEdges" ');

  await writeFile(resolve(outputDirectory, filename), `${svg}\n`, "utf8");
}

for (const filename of await readdir(outputDirectory)) {
  if (filename.startsWith("support-") && !expectedFiles.has(filename)) {
    await unlink(resolve(outputDirectory, filename));
  }
}

console.log(`Generated ${expectedFiles.size} support QR codes.`);
