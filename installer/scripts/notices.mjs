// SPDX-License-Identifier: MPL-2.0
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  join(homedir(), ".cargo/bin/cargo.exe"),
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
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  },
);
if (result.status !== 0) throw new Error("NOTICE_METADATA_FAILED");
const metadata = JSON.parse(result.stdout);
const included = new Set(metadata.resolve.nodes.map((n) => n.id));
const packages = metadata.packages
  .filter((p) => (p.source || p.name === "webview2-com") && included.has(p.id))
  .sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, "en"),
  );
let text =
  "Fennevia native installer third-party notices\n\nFennevia original files: MPL-2.0. The following components keep their own licenses.\nMicrosoft WebView2: see WEBVIEW2-LICENSE.txt and WebView2/show_third_party_software_licenses.bat for the bundled runtime's own credits.\n\n";
for (const pkg of packages) {
  const directory = dirname(pkg.manifest_path);
  const names = readdirSync(directory)
    .filter(
      (n) =>
        /^(license|licence|copying|notice)([._-]|$)/i.test(n) &&
        statSync(join(directory, n)).isFile(),
    )
    .sort();
  if (pkg.license_file && !names.includes(pkg.license_file))
    names.push(pkg.license_file);
  const supplements = {
    "alloc-stdlib": "alloc-stdlib-LICENSE",
    selectors: "selectors-LICENSE",
    "webview2-com": "webview2-com-LICENSE",
    "webview2-com-macros": "webview2-com-macros-LICENSE",
    "webview2-com-sys": "webview2-com-LICENSE",
  };
  const supplement = supplements[pkg.name];
  if (!pkg.license || (!names.length && !supplement))
    throw new Error(`NOTICE_MISSING: ${pkg.name}@${pkg.version}`);
  text += `\n===== ${pkg.name} ${pkg.version} =====\nLicense: ${pkg.license}\nSource: ${pkg.repository ?? pkg.source}\nExact unmodified source: https://crates.io/api/v1/crates/${pkg.name}/${pkg.version}/download\n`;
  if (pkg.name === "webview2-com")
    text +=
      "Fennevia changes the environment default to disable external crash uploads. Modified source: installer/vendor/webview2-com at the Fennevia source commit identified in RELEASE-MANIFEST.json.\n";
  for (const name of names)
    text += `\n--- ${name} ---\n${readFileSync(join(directory, name), "utf8")}\n`;
  if (supplement)
    text += readFileSync(join(root, "licenses", supplement), "utf8") + "\n";
}
for (const file of ["WEBVIEW2-SDK-LICENSE.txt", "WEBVIEW2-SDK-NOTICE.txt"]) {
  text +=
    `\n===== Microsoft WebView2 SDK 1.0.3800.47: ${file} =====\n` +
    readFileSync(join(root, "licenses", file), "utf8") +
    "\n";
}
// Only Svelte and the Tauri API contribute JavaScript to the embedded frontend.
for (const name of ["svelte", "@tauri-apps/api"]) {
  const directory = join(root, "node_modules", name);
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  text += `\n===== ${name} ${pkg.version} =====\n`;
  const names = readdirSync(directory)
    .filter(
      (n) =>
        /^licen[cs]e([._-]|$)/i.test(n) &&
        statSync(join(directory, n)).isFile(),
    )
    .sort();
  if (!names.length) throw new Error("NPM_NOTICE_MISSING");
  for (const file of names)
    text += readFileSync(join(directory, file), "utf8") + "\n";
}
const rust = spawnSync(
  join(homedir(), ".cargo/bin/rustc.exe"),
  ["--print", "sysroot"],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
if (rust.status !== 0) throw new Error("RUST_NOTICES_MISSING");
const rustDocs = join(rust.stdout.trim(), "share/doc/rust");
// Preserve Rust's exact bundled-library copyrights and license references.
text +=
  "\n===== Rust 1.99.1 standard library notices (HTML) =====\n" +
  readFileSync(join(rustDocs, "COPYRIGHT-library.html"), "utf8");
for (const file of readdirSync(join(rustDocs, "licenses")).sort()) {
  text +=
    `\n===== Rust license reference: ${file} =====\n` +
    readFileSync(join(rustDocs, "licenses", file), "utf8");
}
writeFileSync(process.argv[2], text.replaceAll("\r\n", "\n"));
console.log(
  `Assembled notices for ${packages.length} native crates and embedded frontend libraries.`,
);
