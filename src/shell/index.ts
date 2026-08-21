// SPDX-License-Identifier: MPL-2.0
export type { EdgeMountTargets, ShellWindowKind } from "./runtime/contracts";
export {
  getShellAppCapabilities,
  verifyShellAppHealth,
} from "./runtime/health";
export { mountShellApp } from "./runtime/mount-shell";

import "./styles/edge-shell.css";
