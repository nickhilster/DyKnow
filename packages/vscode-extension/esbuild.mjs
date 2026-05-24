// @ts-check
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  // ESM output: VS Code 1.100+ supports ESM extensions and import.meta works.
  format: "esm",
  platform: "node",
  target: "node18",
  // Mark vscode as external — resolved by the extension host at runtime.
  external: ["vscode"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes…");
} else {
  await esbuild.build(options);
}
