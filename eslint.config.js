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
  AbortController: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  process: "readonly",
  setImmediate: "readonly",
  setTimeout: "readonly",
};

const firefoxGlobals = {
  AbortController: "readonly",
  Cc: "readonly",
  ChromeUtils: "readonly",
  Ci: "readonly",
  Services: "readonly",
};

export default defineConfig(
  {
    ignores: [
      "coverage/**",
      ".local-artifacts/**",
      "local-artifacts/**",
      "node_modules/**",
      "profile/chrome/fennevia/content/firefox/**",
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
      "tests/**/*.mjs",
      "vite*.config.ts",
    ],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: [
      "profile/chrome/fennevia/content/*.mjs",
      "profile/chrome/fennevia/content/runtime/*.mjs",
    ],
    languageOptions: {
      globals: firefoxGlobals,
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
  {
    files: [
      "tests/bootstrap-content-access.mjs",
      "tests/firefox-window-lifecycle.mjs",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["profile/chrome/fennevia/content/runtime/Logger.sys.mjs"],
    rules: {
      "no-control-regex": "off",
    },
  },
);
