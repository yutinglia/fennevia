import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import svelte from "eslint-plugin-svelte";
import ts from "typescript-eslint";

import svelteConfig from "./svelte.config.js";

const browserGlobals = {
  AbortSignal: "readonly",
  Element: "readonly",
  Event: "readonly",
  FocusEvent: "readonly",
  HTMLButtonElement: "readonly",
  HTMLDivElement: "readonly",
  HTMLElement: "readonly",
  HTMLImageElement: "readonly",
  HTMLInputElement: "readonly",
  HTMLSelectElement: "readonly",
  HTMLTemplateElement: "readonly",
  KeyboardEvent: "readonly",
  MouseEvent: "readonly",
  DragEvent: "readonly",
  Node: "readonly",
  MutationObserver: "readonly",
  PointerEvent: "readonly",
  Window: "readonly",
};

const nodeGlobals = {
  Buffer: "readonly",
  URL: "readonly",
  console: "readonly",
  process: "readonly",
  setImmediate: "readonly",
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
      "tests/bookmark-state.test.mjs",
      "tests/download-state.test.mjs",
      "tests/edge-surfaces.test.mjs",
      "tests/firefox-bookmarks.test.mjs",
      "tests/firefox-boundary.test.mjs",
      "tests/firefox-downloads.test.mjs",
      "tests/firefox-navigation.test.mjs",
      "tests/firefox-tabs.test.mjs",
      "tests/frontend-smoke.test.mjs",
      "tests/navigation-state.test.mjs",
      "tests/progress-light.test.mjs",
      "tests/tab-state.test.mjs",
      "tests/tab-strip.test.mjs",
      "vite*.config.ts",
    ],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ["src/app/**/*.ts", "src/shell/**/*.{ts,svelte}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Cc",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "ChromeUtils",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "Ci",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "Cr",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "Cu",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "Downloads",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "gBrowser",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "PlacesUtils",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "Services",
          message: "Firefox globals belong in src/firefox/.",
        },
        {
          name: "SessionStore",
          message: "Firefox globals belong in src/firefox/.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/firefox", "**/firefox/**"],
              message:
                "Shell and application state must use ordinary public contracts, not src/firefox implementations.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[computed=false][property.name=/^(Downloads|PlacesUtils|Services|SessionStore|gBrowser)$/]",
          message: "Firefox-owned globals and handles belong in src/firefox/.",
        },
        {
          selector:
            "MemberExpression[computed=true][property.value=/^(Downloads|PlacesUtils|Services|SessionStore|gBrowser)$/]",
          message: "Firefox-owned globals and handles belong in src/firefox/.",
        },
      ],
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
