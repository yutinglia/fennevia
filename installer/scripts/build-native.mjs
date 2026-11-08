// SPDX-License-Identifier: MPL-2.0
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const cargo =
  process.platform === "win32" &&
  existsSync(join(homedir(), ".cargo/bin/cargo.exe"))
    ? join(homedir(), ".cargo/bin/cargo.exe")
    : "cargo";
const result = spawnSync(cargo, ["build", "--locked", "--workspace"], {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) {
  console.error("NATIVE_BUILD_TOOL_UNAVAILABLE");
  process.exit(1);
}
process.exit(result.status ?? 1);
