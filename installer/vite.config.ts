// SPDX-License-Identifier: MPL-2.0
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  build: { target: "es2022", sourcemap: false },
});
