import { build } from "esbuild";
import { readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcFnDir = path.join(root, "src/fn");
const distDir = path.join(root, "dist");

if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

const entries = readdirSync(srcFnDir).filter((f) => f.endsWith(".ts"));

for (const file of entries) {
  const name = file.replace(/\.ts$/, "");
  const outdir = path.join(distDir, name);
  mkdirSync(outdir, { recursive: true });
  await build({
    entryPoints: [path.join(srcFnDir, file)],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: path.join(outdir, "index.mjs"),
    external: [],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    sourcemap: false,
    minify: false,
    logLevel: "info",
  });
}

console.log(`\nbuilt ${entries.length} lambdas to ${distDir}`);
