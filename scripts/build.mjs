import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outFile = path.join(root, "build/server.js");

const sync = spawnSync("node", [path.join(__dirname, "sync-schemas-js.mjs")], {
  stdio: "inherit",
});
if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

fs.mkdirSync(path.join(root, "build"), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "src/server.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});

const output = fs.readFileSync(outFile, "utf8");
if (!output.startsWith("#!")) {
  fs.writeFileSync(outFile, "#!/usr/bin/env node\n" + output);
}
fs.chmodSync(outFile, 0o755);

console.log("build complete");
