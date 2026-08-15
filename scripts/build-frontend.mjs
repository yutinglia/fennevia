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
const configFile = join(projectRoot, "vite.config.ts");
const generatedTarget = join(
  projectRoot,
  "profile",
  "chrome",
  "fennevia",
  "content",
  "shell",
);
const expectedRawFiles = Object.freeze([
  "ShellApp.css",
  "ShellApp.js",
  "third-party-licenses.json",
]);
const expectedGeneratedFiles = Object.freeze([
  "ShellApp.js",
  "ShellStyles.sys.mjs",
  "THIRD_PARTY_NOTICES.txt",
]);
const expectedSvelteDiagnosticSlugs = Object.freeze([
  "async_derived_orphan",
  "derived_inert",
  "each_key_duplicate",
  "effect_in_teardown",
  "effect_in_unowned_derived",
  "effect_orphan",
  "effect_update_depth_exceeded",
  "hydration_mismatch",
  "lifecycle_outside_component",
  "state_descriptors_fixed",
  "state_prototype_fixed",
  "state_unsafe_mutation",
  "svelte_boundary_reset_noop",
  "svelte_boundary_reset_onerror",
]);
const allowedDomNamespaceUris = Object.freeze([
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xhtml",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/2000/svg",
]);
const rawSvelteWhitespaceTemplate = "` \t\n\\r\\f\\xA0\\v\uFEFF`";
const escapedSvelteWhitespaceTemplate = "` \\t\\n\\r\\f\\xA0\\v\\uFEFF`";

/** @param {string} path */
function assertOwnedTarget(path) {
  const expected = resolve(
    projectRoot,
    "profile",
    "chrome",
    "fennevia",
    "content",
    "shell",
  );
  if (resolve(path) !== expected || !expected.startsWith(projectRoot + sep)) {
    throw new Error("FENNEVIA_BUILD_TARGET_INVALID");
  }
}

/**
 * @param {string} directory
 * @param {readonly string[]} expectedFiles
 * @returns {Promise<Map<string, Buffer>>}
 */
async function readExactFlatFiles(directory, expectedFiles) {
  const entries = await readdir(directory, { withFileTypes: true });
  const actualFiles = entries.map((entry) => entry.name).sort();
  if (
    entries.some((entry) => !entry.isFile()) ||
    JSON.stringify(actualFiles) !== JSON.stringify([...expectedFiles].sort())
  ) {
    throw new Error("FENNEVIA_BUILD_OUTPUT_INVENTORY_INVALID");
  }

  /** @type {Array<[string, Buffer]>} */
  const files = await Promise.all(
    actualFiles.map(
      async (name) =>
        /** @type {[string, Buffer]} */ ([
          name,
          await readFile(join(directory, name)),
        ]),
    ),
  );
  return new Map(files);
}

/** @param {string} css */
function renderStyleModule(css) {
  const normalizedCss =
    css
      .replaceAll("\r\n", "\n")
      .replace(/\n?\/\*\$vite\$:\d+\*\/\s*$/u, "")
      .trim() + "\n";
  if (normalizedCss.includes("/*$vite$:")) {
    throw new Error("FENNEVIA_BUILD_CSS_MARKER_UNEXPECTED");
  }
  return Buffer.from(
    `export const shellAppCss = ${JSON.stringify(normalizedCss)};\n`,
    "utf8",
  );
}

/** @param {Buffer} bundle */
function replaceSvelteDiagnosticUris(bundle) {
  const source = bundle.toString("utf8");
  if (source.split(rawSvelteWhitespaceTemplate).length - 1 !== 1) {
    throw new Error("FENNEVIA_BUILD_SVELTE_WHITESPACE_SET_INVALID");
  }
  const normalizedSource = source.replace(
    rawSvelteWhitespaceTemplate,
    escapedSvelteWhitespaceTemplate,
  );
  const pattern = /https:\/\/svelte\.dev\/e\/([a-z0-9_]+)/gu;
  const slugs = [...normalizedSource.matchAll(pattern)]
    .map((match) => match[1])
    .sort();
  if (
    JSON.stringify(slugs) !==
    JSON.stringify([...expectedSvelteDiagnosticSlugs].sort())
  ) {
    throw new Error("FENNEVIA_BUILD_SVELTE_DIAGNOSTIC_SET_INVALID");
  }

  const replaced = normalizedSource.replace(
    pattern,
    (_match, slug) => `FENNEVIA_SVELTE_RUNTIME_${String(slug).toUpperCase()}`,
  );
  let endpointCandidate = replaced;
  for (const namespaceUri of allowedDomNamespaceUris) {
    for (const quote of ['"', "'", "`"]) {
      endpointCandidate = endpointCandidate.replaceAll(
        `${quote}${namespaceUri}${quote}`,
        "",
      );
    }
  }
  if (/\b(?:https?|wss?):\/\//iu.test(endpointCandidate)) {
    throw new Error("FENNEVIA_BUILD_RUNTIME_ENDPOINT_UNEXPECTED");
  }
  return Buffer.from(replaced, "utf8");
}

/** @param {string} rawLicenseJson */
function renderThirdPartyNotices(rawLicenseJson) {
  const records = JSON.parse(rawLicenseJson);
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("FENNEVIA_BUILD_LICENSE_INVENTORY_INVALID");
  }

  /** @type {Array<{identifier: string; name: string; text: string; version: string}>} */
  const normalized = records
    .map((record) => {
      if (
        typeof record?.name !== "string" ||
        typeof record?.version !== "string" ||
        typeof record?.identifier !== "string" ||
        typeof record?.text !== "string"
      ) {
        throw new Error("FENNEVIA_BUILD_LICENSE_RECORD_INVALID");
      }
      return {
        identifier: record.identifier,
        name: record.name,
        text: record.text
          .replaceAll("\r\n", "\n")
          .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
          .trim(),
        version: record.version,
      };
    })
    .sort((left, right) =>
      `${left.name}@${left.version}`.localeCompare(
        `${right.name}@${right.version}`,
        "en",
      ),
    );

  const notice = [
    "Fennevia bundled third-party notices",
    "",
    "This generated file lists code included in ShellApp.js.",
    ...normalized.flatMap((record) => [
      "",
      `Package: ${record.name}@${record.version}`,
      `License: ${record.identifier}`,
      "",
      record.text,
    ]),
    "",
  ].join("\n");
  if (/\b(?:https?|wss?):\/\//iu.test(notice)) {
    throw new Error("FENNEVIA_BUILD_LICENSE_ENDPOINT_UNEXPECTED");
  }
  return Buffer.from(notice, "utf8");
}

/**
 * @param {string} directory
 * @returns {Promise<Map<string, Buffer>>}
 */
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

  const raw = await readExactFlatFiles(directory, expectedRawFiles);
  return new Map([
    [
      "ShellApp.js",
      replaceSvelteDiagnosticUris(requireFile(raw, "ShellApp.js")),
    ],
    [
      "ShellStyles.sys.mjs",
      renderStyleModule(requireFile(raw, "ShellApp.css").toString("utf8")),
    ],
    [
      "THIRD_PARTY_NOTICES.txt",
      renderThirdPartyNotices(
        requireFile(raw, "third-party-licenses.json").toString("utf8"),
      ),
    ],
  ]);
}

/**
 * @param {Map<string, Buffer>} files
 * @param {string} name
 */
function requireFile(files, name) {
  const content = files.get(name);
  if (!content) {
    throw new Error(`FENNEVIA_BUILD_FILE_MISSING:${name}`);
  }
  return content;
}

/** @param {Buffer} content */
function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * @param {Map<string, Buffer>} first
 * @param {Map<string, Buffer>} second
 */
function assertDeterministic(first, second) {
  for (const name of expectedGeneratedFiles) {
    const firstContent = first.get(name);
    const secondContent = second.get(name);
    if (
      !firstContent ||
      !secondContent ||
      !firstContent.equals(secondContent)
    ) {
      throw new Error(`FENNEVIA_BUILD_NONDETERMINISTIC:${name}`);
    }
  }
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "fennevia-frontend-build-"));
const canonicalTemporaryRoot = resolve(temporaryRoot);
const canonicalOsTemp = resolve(tmpdir());
if (
  canonicalTemporaryRoot === canonicalOsTemp ||
  !canonicalTemporaryRoot.startsWith(canonicalOsTemp + sep) ||
  !canonicalTemporaryRoot.includes("fennevia-frontend-build-")
) {
  throw new Error("FENNEVIA_BUILD_TEMP_CLEANUP_REFUSED");
}
try {
  const first = await buildOnce(join(temporaryRoot, "first"));
  const second = await buildOnce(join(temporaryRoot, "second"));
  assertDeterministic(first, second);

  assertOwnedTarget(generatedTarget);
  await rm(generatedTarget, { force: true, recursive: true });
  await mkdir(generatedTarget, { recursive: true });
  for (const name of expectedGeneratedFiles) {
    await writeFile(join(generatedTarget, name), requireFile(first, name));
  }

  const generated = await readExactFlatFiles(
    generatedTarget,
    expectedGeneratedFiles,
  );
  const summary = Object.fromEntries(
    expectedGeneratedFiles.map((name) => [
      relative(projectRoot, join(generatedTarget, name)).replaceAll(sep, "/"),
      {
        bytes: requireFile(generated, name).byteLength,
        sha256: digest(requireFile(generated, name)),
      },
    ]),
  );
  process.stdout.write(
    `${JSON.stringify({ deterministic: true, files: summary })}\n`,
  );
} finally {
  await rm(canonicalTemporaryRoot, { force: true, recursive: true });
}
