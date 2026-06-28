import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsPath = path.join(__dirname, "../src/client/schemas.gen.ts");
const jsPath = path.join(__dirname, "../src/client/schemas.gen.js");

const src = fs.readFileSync(tsPath, "utf8");
// ponytail: naive regex TS→CJS — breaks if openapi-ts changes export syntax.
// Upgrade path: emit schemas as JSON from genclient, or bundle schemas.gen.ts via esbuild only.
const body = src
  .replace(/^\/\/[^\n]*\n/gm, "")
  .replace(/^export const /gm, "exports.")
  .replace(/ as const;/g, ";");

fs.writeFileSync(
  jsPath,
  "// Auto-generated from schemas.gen.ts — do not edit by hand.\n" + body,
);
