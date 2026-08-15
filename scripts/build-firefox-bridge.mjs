import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configFile = join(projectRoot, "vite.firefox.config.ts");
const generatedTarget = join(
  projectRoot,
  "profile",
  "chrome",
  "fennevia",
  "content",
  "firefox",
);
const generatedFileName = "BridgeBoundary.sys.mjs";

/** @param {string} path */
function assertOwnedTarget(path) {
  const expected = resolve(
    projectRoot,
    "profile",
    "chrome",
    "fennevia",
    "content",
    "firefox",
  );
  if (resolve(path) !== expected || !expected.startsWith(projectRoot + sep)) {
    throw new Error("FENNEVIA_BRIDGE_BUILD_TARGET_INVALID");
  }
}

/** @param {string} directory */
async function readExactOutput(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (
    entries.length !== 1 ||
    !entries[0].isFile() ||
    entries[0].name !== generatedFileName
  ) {
    throw new Error("FENNEVIA_BRIDGE_BUILD_OUTPUT_INVENTORY_INVALID");
  }
  return readFile(join(directory, generatedFileName));
}

/** @param {string} directory */
async function buildOnce(directory) {
  await build({
    build: {
      emptyOutDir: true,
      outDir: directory,
    },
    configFile,
    logLevel: "warn",
    mode: "production",
  });
  const output = await readExactOutput(directory);
  const source = output.toString("utf8");
  if (
    /sourceMappingURL|import\.meta\.hot/u.test(source) ||
    /\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|importScripts)\s*\(/u.test(
      source,
    ) ||
    /\b(?:https?|wss?):\/\//iu.test(source)
  ) {
    throw new Error("FENNEVIA_BRIDGE_BUILD_RUNTIME_CONTENT_INVALID");
  }
  return output;
}

/** @param {Buffer} content */
function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

const temporaryRoot = await mkdtemp(
  join(tmpdir(), "fennevia-firefox-bridge-build-"),
);
const canonicalTemporaryRoot = resolve(temporaryRoot);
const canonicalOsTemp = resolve(tmpdir());
if (
  canonicalTemporaryRoot === canonicalOsTemp ||
  !canonicalTemporaryRoot.startsWith(canonicalOsTemp + sep) ||
  !canonicalTemporaryRoot.includes("fennevia-firefox-bridge-build-")
) {
  throw new Error("FENNEVIA_BRIDGE_BUILD_TEMP_CLEANUP_REFUSED");
}

try {
  const first = await buildOnce(join(temporaryRoot, "first"));
  const second = await buildOnce(join(temporaryRoot, "second"));
  if (!first.equals(second)) {
    throw new Error("FENNEVIA_BRIDGE_BUILD_NONDETERMINISTIC");
  }

  assertOwnedTarget(generatedTarget);
  await rm(generatedTarget, { force: true, recursive: true });
  await mkdir(generatedTarget, { recursive: true });
  await writeFile(join(generatedTarget, generatedFileName), first);
  const installed = await readExactOutput(generatedTarget);

  process.stdout.write(
    `${JSON.stringify({
      deterministic: true,
      files: {
        [relative(
          projectRoot,
          join(generatedTarget, generatedFileName),
        ).replaceAll(sep, "/")]: {
          bytes: installed.byteLength,
          sha256: digest(installed),
        },
      },
    })}\n`,
  );
} finally {
  await rm(canonicalTemporaryRoot, { force: true, recursive: true });
}
