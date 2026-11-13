import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src");

export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const readText = (path) => readFileSync(path, "utf8");

export function listFiles(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full, ext);
    return full.endsWith(ext) ? [full] : [];
  });
}
