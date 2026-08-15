import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const bridgeEntry = fileURLToPath(
  new URL("./src/firefox/index.ts", import.meta.url),
);

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: bridgeEntry,
      fileName: () => "BridgeBoundary.sys.mjs",
      formats: ["es"],
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
