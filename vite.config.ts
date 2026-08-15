import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const shellEntry = fileURLToPath(
  new URL("./src/shell/entry.ts", import.meta.url),
);

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        fragments: "tree",
      },
    }),
  ],
  build: {
    cssCodeSplit: false,
    cssMinify: false,
    emptyOutDir: true,
    lib: {
      cssFileName: "ShellApp",
      entry: shellEntry,
      fileName: () => "ShellApp.js",
      formats: ["iife"],
      name: "FenneviaShellFrontendBundle",
    },
    license: {
      fileName: "third-party-licenses.json",
    },
    minify: "oxc",
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: false,
        comments: false,
      },
    },
    sourcemap: false,
    target: "firefox153",
  },
});
