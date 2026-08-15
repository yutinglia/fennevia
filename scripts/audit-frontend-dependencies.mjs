import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const packageLock = JSON.parse(
  await readFile(path.join(projectRoot, "package-lock.json"), "utf8"),
);
const outputPath = path.join(
  projectRoot,
  "docs",
  "dependency-reviews",
  "frontend-toolchain-lock-inventory.json",
);
const lifecycleNames = Object.freeze(["preinstall", "install", "postinstall"]);
const nativeExtensions = new Set([".dll", ".exe", ".node", ".wasm"]);

if (
  packageLock.lockfileVersion !== 3 ||
  packageJson.packageManager !== "npm@11.16.0" ||
  packageJson.engines?.node !== "24.18.0"
) {
  throw new Error("FENNEVIA_DEPENDENCY_AUDIT_TOOLCHAIN_INVALID");
}

/** @param {string} packagePath */
function nameFromPackagePath(packagePath) {
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  if (index === -1) {
    throw new Error("FENNEVIA_DEPENDENCY_AUDIT_PATH_INVALID");
  }
  return packagePath.slice(index + marker.length);
}

/** @param {string} candidate */
async function fileExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

/** @param {unknown} license */
function normalizeLicense(license) {
  if (typeof license === "string") {
    return license;
  }
  if (
    license &&
    typeof license === "object" &&
    "type" in license &&
    typeof license.type === "string"
  ) {
    return license.type;
  }
  return null;
}

/**
 * @param {string} directory
 * @param {string} prefix
 * @returns {Promise<string[]>}
 */
async function findNativeFiles(directory, prefix = "node_modules") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    const absolute = path.join(directory, entry.name);
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await findNativeFiles(absolute, relative)));
    } else if (
      entry.isFile() &&
      nativeExtensions.has(path.extname(entry.name))
    ) {
      files.push(relative);
    }
  }
  return files;
}

const packageEntries = [];
for (const [packagePath, lockEntry] of Object.entries(packageLock.packages)
  .filter(([packagePath]) => packagePath !== "")
  .sort(([left], [right]) => left.localeCompare(right, "en"))) {
  const name = nameFromPackagePath(packagePath);
  const manifestPath = path.join(
    projectRoot,
    ...packagePath.split("/"),
    "package.json",
  );
  const installed = await fileExists(manifestPath);
  const installedManifest = installed
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : null;
  const lifecycleScripts = Object.fromEntries(
    lifecycleNames.flatMap((scriptName) => {
      const command = installedManifest?.scripts?.[scriptName];
      return typeof command === "string" ? [[scriptName, command]] : [];
    }),
  );
  const lockLicense = normalizeLicense(lockEntry.license);
  const installedLicense = normalizeLicense(installedManifest?.license);

  if (
    typeof lockEntry.version !== "string" ||
    typeof lockEntry.resolved !== "string" ||
    !lockEntry.resolved.startsWith("https://registry.npmjs.org/") ||
    typeof lockEntry.integrity !== "string" ||
    !lockEntry.integrity.startsWith("sha") ||
    !lockLicense ||
    (installed &&
      (installedManifest.name !== name ||
        installedManifest.version !== lockEntry.version ||
        (installedLicense && installedLicense !== lockLicense)))
  ) {
    throw new Error("FENNEVIA_DEPENDENCY_AUDIT_ENTRY_INVALID");
  }

  packageEntries.push({
    bin: lockEntry.bin ?? null,
    cpu: lockEntry.cpu ?? null,
    dev: Boolean(lockEntry.dev),
    hasInstallScript: Boolean(lockEntry.hasInstallScript),
    installed,
    integrity: lockEntry.integrity,
    libc: lockEntry.libc ?? null,
    license: lockLicense,
    lifecycleScripts,
    name,
    optional: Boolean(lockEntry.optional),
    os: lockEntry.os ?? null,
    packagePath,
    resolved: lockEntry.resolved,
    version: lockEntry.version,
  });
}

const installedLifecyclePackages = packageEntries.filter(
  (entry) => Object.keys(entry.lifecycleScripts).length > 0,
);
if (installedLifecyclePackages.length !== 0) {
  throw new Error("FENNEVIA_DEPENDENCY_AUDIT_INSTALLED_LIFECYCLE_UNEXPECTED");
}

const nativeFiles = await findNativeFiles(
  path.join(projectRoot, "node_modules"),
);
const inventory = {
  schemaVersion: 1,
  generatedFrom: "package-lock.json",
  packageManager: packageJson.packageManager,
  platform: {
    arch: process.arch,
    node: process.version,
    os: process.platform,
  },
  summary: {
    binPackageCount: packageEntries.filter((entry) => entry.bin).length,
    directDependencyCount: Object.keys(packageJson.devDependencies).length,
    installScriptFlagCount: packageEntries.filter(
      (entry) => entry.hasInstallScript,
    ).length,
    installedLifecyclePackageCount: installedLifecyclePackages.length,
    installedPackagePathCount: packageEntries.filter((entry) => entry.installed)
      .length,
    lockPackagePathCount: packageEntries.length,
    nativeFileCount: nativeFiles.length,
    optionalPackagePathCount: packageEntries.filter((entry) => entry.optional)
      .length,
    uniqueNameVersionCount: new Set(
      packageEntries.map((entry) => `${entry.name}@${entry.version}`),
    ).size,
    wasmFileCount: nativeFiles.filter((file) => file.endsWith(".wasm")).length,
  },
  nativeFiles,
  packages: packageEntries,
};

await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(inventory.summary)}\n`);
