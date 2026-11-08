// SPDX-License-Identifier: MPL-2.0
// Evidence inventory, not an automatic license or security approval.
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const cargo =
  process.platform === "win32" &&
  existsSync(join(homedir(), ".cargo/bin/cargo.exe"))
    ? join(homedir(), ".cargo/bin/cargo.exe")
    : "cargo";
const result = spawnSync(
  cargo,
  [
    "metadata",
    "--locked",
    "--format-version",
    "1",
    "--filter-platform",
    "x86_64-pc-windows-msvc",
  ],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  },
);
if (result.status !== 0) {
  console.error("DEPENDENCY_METADATA_FAILED");
  process.exit(1);
}
const metadata = JSON.parse(result.stdout);
const included = new Set(metadata.resolve.nodes.map((node) => node.id));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cargoLock = readFileSync(join(root, "Cargo.lock"), "utf8");
const cargoChecksums = new Map(
  cargoLock
    .split("[[package]]")
    .slice(1)
    .map((block) => {
      const field = (name) =>
        block.match(new RegExp(`^${name} = "([^"]*)"`, "m"))?.[1];
      return [
        `${field("name")}@${field("version")}`,
        field("checksum") ?? null,
      ];
    }),
);
const crates = metadata.packages
  .filter(
    (pkg) =>
      included.has(pkg.id) && (pkg.source || pkg.name === "webview2-com"),
  )
  .map((pkg) => {
    const directory = dirname(pkg.manifest_path);
    const vcs = join(directory, ".cargo_vcs_info.json");
    const notices = readdirSync(directory)
      .filter((name) =>
        /^(license|licence|copying|notice)([._-]|$)/i.test(name),
      )
      .flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isFile()
          ? [{ name, sha256: sha256(readFileSync(path)) }]
          : [];
      });
    return {
      name: pkg.name,
      version: pkg.version,
      checksum: cargoChecksums.get(`${pkg.name}@${pkg.version}`),
      source:
        pkg.source ??
        "vendored:webview2-com (privacy default patch; see FENNEVIA-PATCH.md)",
      repository: pkg.repository,
      license: pkg.license,
      licenseFile: pkg.license_file,
      vcs: existsSync(vcs) ? JSON.parse(readFileSync(vcs, "utf8")) : null,
      buildScript: pkg.targets.some((target) =>
        target.kind.includes("custom-build"),
      ),
      notices,
    };
  })
  .sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") ||
      a.version.localeCompare(b.version, "en"),
  );
const npmLock = JSON.parse(
  readFileSync(join(root, "package-lock.json"), "utf8"),
);
const npm = Object.entries(npmLock.packages)
  .filter(([path]) => path)
  .map(([path, data]) => ({
    path,
    version: data.version,
    resolved: data.resolved,
    integrity: data.integrity,
    license: data.license,
    optional: data.optional ?? false,
    hasInstallScript: data.hasInstallScript ?? false,
  }));
const inventory = {
  schemaVersion: 1,
  target: "x86_64-pc-windows-msvc",
  reviewStatus: "windows-distribution-reviewed-see-tauri-installer-2026-11-09",
  cargoLockSha256: sha256(cargoLock),
  npmLockSha256: sha256(readFileSync(join(root, "package-lock.json"))),
  crates,
  npm,
};
writeFileSync(
  new URL(
    "../../docs/dependency-reviews/tauri-installer-lock-inventory.json",
    import.meta.url,
  ),
  JSON.stringify(inventory, null, 2) + "\n",
);
console.log(
  `Recorded ${crates.length} Windows dependency crates and ${npm.length} npm lock entries.`,
);
