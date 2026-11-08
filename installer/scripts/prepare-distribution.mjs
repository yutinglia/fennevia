// SPDX-License-Identifier: MPL-2.0
// Build-time packaging only. No downloads occur in the installer application.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  statSync,
} from "node:fs";
import { resolve, join, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(process.argv[2] ?? join(root, "out/native"));
const target = resolve(process.env.CARGO_TARGET_DIR ?? join(root, "target"));
if (existsSync(output) && readdirSync(output).length)
  throw new Error("DISTRIBUTION_OUTPUT_MUST_BE_EMPTY");
mkdirSync(output, { recursive: true });
const cargo = join(homedir(), ".cargo/bin/cargo.exe");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    windowsHide: true,
    stdio: "inherit",
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error("DISTRIBUTION_COMMAND_FAILED");
  return result;
};
const runtime = JSON.parse(
  readFileSync(join(root, "runtime/webview2.json"), "utf8"),
);
const cache = join(root, ".cache");
mkdirSync(cache, { recursive: true });
const cab = join(cache, `webview2-${runtime.version}-x64.cab`);
if (!existsSync(cab)) {
  const response = await globalThis.fetch(runtime.source);
  if (!response.ok) throw new Error("RUNTIME_DOWNLOAD_FAILED");
  writeFileSync(cab, new Uint8Array(await response.arrayBuffer()));
}
if (hash(readFileSync(cab)) !== runtime.sha256)
  throw new Error("RUNTIME_CAB_HASH_MISMATCH");
const extracted = join(cache, "runtime");
const runtimeRoot = join(
  extracted,
  `Microsoft.WebView2.FixedVersionRuntime.${runtime.version}.x64`,
);
if (!existsSync(runtimeRoot)) {
  mkdirSync(extracted, { recursive: true });
  run("expand.exe", ["-F:*", cab, extracted], { stdio: "ignore" });
}
for (const file of runtime.files) {
  if (!file.path.startsWith("WebView2/"))
    throw new Error("INVALID_RUNTIME_PIN");
  const part = file.path.slice("WebView2/".length);
  const source = resolve(runtimeRoot, part);
  const inside = relative(runtimeRoot, source);
  if (
    inside.startsWith("..") ||
    isAbsolute(inside) ||
    statSync(source).size !== file.size ||
    hash(readFileSync(source)) !== file.sha256
  )
    throw new Error("RUNTIME_FILE_HASH_MISMATCH");
  const destination = join(output, file.path);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}
// Remap build paths and request deterministic PE output. Do not patch binaries.
const flags = [
  "-C",
  "target-feature=+crt-static",
  "-C",
  "link-arg=/Brepro",
  `--remap-path-prefix=${resolve(root, "..")}=/fennevia`,
  `--remap-path-prefix=${join(homedir(), ".cargo")}=/cargo`,
  `--remap-path-prefix=${target}=/target`,
].join("\u001f");
run(
  cargo,
  ["build", "--locked", "--release", "-p", "fennevia-installer-worker"],
  {
    env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags },
  },
);
const workerHash = hash(
  readFileSync(join(target, "release/fennevia-installer-worker.exe")),
);
run(cargo, ["build", "--locked", "--release", "-p", "fennevia-setup"], {
  env: {
    ...process.env,
    CARGO_ENCODED_RUSTFLAGS: flags,
    FENNEVIA_WORKER_SHA256: workerHash,
  },
});
copyFileSync(
  join(target, "release/fennevia-setup.exe"),
  join(output, "FenneviaSetup.exe"),
);
copyFileSync(
  join(target, "release/fennevia-installer-worker.exe"),
  join(output, "fennevia-installer-worker.exe"),
);
for (const name of ["FenneviaSetup.exe", "fennevia-installer-worker.exe"]) {
  const bytes = readFileSync(join(output, name));
  for (const encoding of ["latin1", "utf16le"]) {
    const text = bytes.toString(encoding).toLowerCase();
    if (
      /[a-z]:[\\/](?:users|works)[\\/]/.test(text) ||
      [resolve(root, ".."), homedir()].some((path) =>
        [path, path.replaceAll("\\", "/")].some((value) =>
          text.includes(value.toLowerCase()),
        ),
      )
    ) {
      throw new Error("NATIVE_BINARY_CONTAINS_LOCAL_BUILD_PATH");
    }
  }
}
copyFileSync(
  join(root, "runtime/WEBVIEW2-LICENSE.txt"),
  join(output, "WEBVIEW2-LICENSE.txt"),
);
copyFileSync(
  join(root, "runtime/webview2.json"),
  join(output, "WEBVIEW2-INVENTORY.json"),
);
run(process.execPath, [
  join(root, "scripts/notices.mjs"),
  join(output, "INSTALLER-NOTICES.txt"),
]);
const files = [...runtime.files];
for (const path of [
  "FenneviaSetup.exe",
  "fennevia-installer-worker.exe",
  "WEBVIEW2-LICENSE.txt",
  "WEBVIEW2-INVENTORY.json",
  "INSTALLER-NOTICES.txt",
]) {
  const bytes = readFileSync(join(output, path));
  files.push({ path, sha256: hash(bytes), size: bytes.length });
}
files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
writeFileSync(
  join(output, "INSTALLER-MANIFEST.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      platform: "windows",
      architecture: "x64",
      webview2Version: runtime.version,
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared native installer with ${files.length} verified files.`);
