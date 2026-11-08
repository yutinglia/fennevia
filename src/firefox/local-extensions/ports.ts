// SPDX-License-Identifier: MPL-2.0
import type { Metadata, Payload } from "./model.ts";
export type NativeAddon = Readonly<{
  id: string;
  temporarilyInstalled: boolean;
  sourceURI: { spec: string };
  userDisabled: boolean;
  isActive: boolean;
  appDisabled: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  reload: () => Promise<void>;
  uninstall: () => Promise<void>;
}>;
export type NativeEvent =
  "installing" | "installed" | "disabled" | "enabled" | "removed";
export type LocalExtensionPort = Readonly<{
  uuid: () => string;
  ready: () => Promise<void>;
  allowed: () => boolean;
  enabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  read: () => Promise<string | null>;
  write: (next: string, expected: string | null) => Promise<void>;
  choose: (
    window: object,
    source: "file" | "folder",
    title: string,
    signal: AbortSignal,
  ) => Promise<string | null>;
  stage: (
    source: string,
    kind: "file" | "folder",
    key?: string,
  ) => Promise<Payload>;
  inspect: (payload: Payload) => Promise<Metadata>;
  verify: (payload: Payload) => Promise<void>;
  remove: (payload: Payload) => Promise<void>;
  uri: (payload: Payload) => string;
  get: (id: string) => Promise<NativeAddon | null>;
  install: (payload: Payload) => Promise<NativeAddon>;
  listen: (
    listener: (event: NativeEvent, addon: NativeAddon) => void,
  ) => () => void;
  open: (window: object, target: "open-addons" | "open-debugging") => void;
}>;
