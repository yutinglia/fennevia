// SPDX-License-Identifier: MPL-2.0
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// The app stays hidden and exits only after the embedded frontend invokes its
// health command. This is not a visual or keyboard acceptance test.
const binary =
  process.argv[2] ??
  fileURLToPath(new URL("../target/debug/fennevia-setup.exe", import.meta.url));
const result = spawnSync(binary, ["--smoke-test"], {
  timeout: 30000,
  windowsHide: true,
  stdio: "ignore",
});
if (result.error || result.status !== 0) {
  console.error("NATIVE_WEBVIEW_SMOKE_FAILED");
  process.exit(1);
}
console.log("Native WebView loaded the embedded frontend and completed IPC.");
const worker = spawnSync(binary, ["--worker-smoke-test"], {
  timeout: 30000,
  windowsHide: true,
  stdio: "ignore",
});
if (worker.error || worker.status !== 0) {
  console.error("NATIVE_WORKER_IPC_SMOKE_FAILED");
  process.exit(1);
}
console.log(
  "Native worker authenticated IPC and rejected nonexistent targets without mutation.",
);
