// Bundles the TypeScript entry points with esbuild and copies static assets
// into dist/, which is the folder Chrome loads as the unpacked extension.
import { context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { watch as watchFiles } from "node:fs";

const watch = process.argv.includes("--watch");
const STATIC_FILES = ["manifest.json", "base.css", "add.html", "add.css", "options.html", "options.css", "icons"];

async function copyStatic() {
  await Promise.all(STATIC_FILES.map((file) => cp(`src/${file}`, `dist/${file}`, { recursive: true })));
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await copyStatic();

const bundler = await context({
  entryPoints: ["src/background.ts", "src/add.ts", "src/options.ts", "src/slackmojis.ts"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome116",
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
});

if (watch) {
  await bundler.watch();
  watchFiles("src", { recursive: true }, (_event, file) => {
    if (file && !file.endsWith(".ts")) copyStatic().catch(console.error);
  });
} else {
  await bundler.rebuild();
  await bundler.dispose();
}
