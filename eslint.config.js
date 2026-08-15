import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import svelte from "eslint-plugin-svelte";
import ts from "typescript-eslint";

import svelteConfig from "./svelte.config.js";

const browserGlobals = {
  AbortSignal: "readonly",
  Element: "readonly",
  Event: "readonly",
  HTMLInputElement: "readonly",
  HTMLTemplateElement: "readonly",
  Node: "readonly",
};

const nodeGlobals = {
  Buffer: "readonly",
  console: "readonly",
  process: "readonly",
};

export default defineConfig(
  {
    ignores: [
      "coverage/**",
      ".local-artifacts/**",
      "local-artifacts/**",
      "node_modules/**",
      "profile/chrome/fennevia/content/shell/**",
    ],
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    files: ["src/**/*.{ts,svelte}"],
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    files: [
      "eslint.config.js",
      "scripts/*.mjs",
      "svelte.config.js",
      "tests/frontend-smoke.test.mjs",
      "vite.config.ts",
    ],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    rules: {
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
