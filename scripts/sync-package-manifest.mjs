import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(projectRoot, "package-manifest.json");
const packagePath = join(projectRoot, "package.json");

const packageFiles = Object.freeze([
  Object.freeze({ scope: "program", path: "defaults/pref/fennevia.js" }),
  Object.freeze({ scope: "program", path: "fennevia.cfg" }),
  Object.freeze({ scope: "profile", path: "chrome/fennevia/chrome.manifest" }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/Bootstrap.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/firefox/BridgeBoundary.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/runtime/HealthState.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/runtime/Logger.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/runtime/Runtime.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/runtime/WindowManager.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/runtime/WindowShell.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/shell/ShellApp.js",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/shell/ShellStyles.sys.mjs",
  }),
  Object.freeze({
    scope: "profile",
    path: "chrome/fennevia/content/shell/THIRD_PARTY_NOTICES.txt",
  }),
]);

/**
 * @typedef {{scope: "program" | "profile"; path: string}} PackageFile
 */

/** @param {PackageFile} file */
function sourcePathFor(file) {
  return join(projectRoot, file.scope, ...file.path.split("/"));
}

/** @param {Buffer} content */
function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

const packageMetadata = JSON.parse(await readFile(packagePath, "utf8"));
if (
  packageMetadata.name !== "fennevia" ||
  typeof packageMetadata.version !== "string"
) {
  throw new Error("FENNEVIA_PACKAGE_METADATA_INVALID");
}

/** @type {Array<{scope: string; path: string; sha256: string}>} */
const files = [];
for (const file of packageFiles) {
  const content = await readFile(sourcePathFor(file));
  files.push({
    scope: file.scope,
    path: file.path,
    sha256: digest(content),
  });
}

const profilePrefix = "chrome/fennevia/";
const expectedFiles = files
  .filter((file) => file.scope === "profile")
  .map((file) => {
    if (!file.path.startsWith(profilePrefix)) {
      throw new Error("FENNEVIA_PACKAGE_PROFILE_PATH_INVALID");
    }
    return file.path.slice(profilePrefix.length);
  });

const manifest = {
  schemaVersion: 1,
  packageId: "fennevia",
  packageVersion: packageMetadata.version,
  expectedFiles,
  files,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ packageVersion: manifest.packageVersion, files: files.length })}\n`,
);
