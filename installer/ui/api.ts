// SPDX-License-Identifier: MPL-2.0
import { invoke as nativeInvoke, isTauri } from "@tauri-apps/api/core";
export interface Choice {
  token: string;
  label: string;
  detail: string;
  available: boolean;
  isDefault: boolean;
}
export interface SavedChoice {
  id: string;
  firefox: Choice;
  profile: Choice;
}
export interface Scan {
  programs: Choice[];
  profiles: Choice[];
  saved: SavedChoice[];
  warnings: string[];
  savedError: string | null;
}
export interface InstallationStatus {
  state: "absent" | "enabled" | "disabled";
  version: string | null;
  missingFiles: number;
  changedFiles: number;
  incomplete: boolean;
}
export interface PackageChoice {
  token: string;
  version: string;
  fileCount: number;
}
export type Action =
  "install" | "update" | "repair" | "disable" | "enable" | "uninstall";
export interface Preview {
  action: Action;
  state: string;
  version: string | null;
  digest: string;
  executable: false;
  approval: string | null;
  operations: {
    kind:
      | "CreateDirectory"
      | "CreateFile"
      | "ReplaceFile"
      | "RemoveFile"
      | "MoveFile"
      | "RemoveDirectoryIfEmpty";
    scope: "program" | "profile";
    path: string;
    destinationPath: string;
  }[];
}
export interface Applied {
  outcome: {
    state: "committed" | "rolledBack" | "unchanged";
    mutations: number;
    error: string | null;
  };
  elevationApproval: string | null;
}
export interface Progress {
  phase: "preparing" | "applying" | "rollingBack" | "finishing";
  completed: number;
  total: number;
}
export function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) return Promise.reject("NATIVE_HOST_REQUIRED");
  return nativeInvoke<T>(command, args);
}
