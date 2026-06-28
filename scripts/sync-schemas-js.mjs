import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsPath = path.join(__dirname, "../src/client/schemas.gen.ts");
const jsPath = path.join(__dirname, "../src/client/schemas.gen.js");

const src = fs.readFileSync(tsPath, "utf8");
const body = src
  .replace(/^\/\/[^\n]*\n/gm, "")
  .replace(/^export const /gm, "exports.")
  .replace(/ as const;/g, ";");

fs.writeFileSync(
  jsPath,
  "// Auto-generated from schemas.gen.ts — do not edit by hand.\n" + body,
);
