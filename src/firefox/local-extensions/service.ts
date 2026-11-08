// SPDX-License-Identifier: MPL-2.0
import {
  copyLocalExtensionRequest,
  copyLocalExtensionsSnapshot,
  type LocalExtensionRequest,
  type LocalExtensionResult,
  type LocalExtensionState,
  type LocalExtensionsBridge,
  type LocalExtensionsSnapshot,
} from "../../app/local-extensions.ts";
import {
  failure,
  limits,
  LocalExtensionError,
  parseRegistry,
  sameMetadata,
  type Entry,
  type Metadata,
  type Payload,
  type Registry,
} from "./model.ts";
import type { LocalExtensionPort, NativeAddon, NativeEvent } from "./ports.ts";

type Owned = { addon: NativeAddon; payload: Payload };
type Prepared = {
  payload: Payload;
  metadata: Metadata;
  revision: number;
  token: string;
  key?: string;
};
export function createLocalExtensionService(
  port: LocalExtensionPort,
  report: (error: unknown) => void,
) {
  let registry: Registry = { version: 1, revision: 0, entries: [] };
  let raw: string | null = null;
  let status: LocalExtensionsSnapshot["status"] = "starting";
  let stopped = false;
  let shutdown = false;
  let busy = false;
  let initialization: Promise<void> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let unlisten: (() => void) | null = null;
  let mutation: { id: string; uri: string; conflict: boolean } | null = null;
  const owned = new Map<string, Owned>();
  const states = new Map<string, LocalExtensionState>();
  const subscribers = new Set<() => void>();
  const sessions = new Set<() => void>();
  const staged = new Set<string>();
  const entryFor = (key: string) =>
    registry.entries.find((entry) => entry.payload.key === key);
  const publish = () => {
    for (const listener of subscribers) {
      try {
        listener();
      } catch (error) {
        subscribers.delete(listener);
        report(error);
      }
    }
  };
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const pending = queue.then(work);
    queue = pending.catch(() => undefined);
    return pending;
  };
  const save = async (entries: readonly Entry[]) => {
    const next: Registry = {
      version: 1,
      revision: registry.revision + 1,
      entries,
    };
    const text = JSON.stringify(next);
    parseRegistry(text);
    await port.write(text, raw);
    registry = next;
    raw = text;
    publish();
  };
  const replace = async (entry: Entry) =>
    save(
      registry.entries.some((item) => item.payload.key === entry.payload.key)
        ? registry.entries.map((item) =>
            item.payload.key === entry.payload.key ? entry : item,
          )
        : [...registry.entries, entry],
    );
  const isOwned = (addon: NativeAddon | null, id: string): boolean => {
    const proof = owned.get(id);
    return (
      !!addon &&
      !!proof &&
      addon === proof.addon &&
      addon.temporarilyInstalled &&
      addon.id === id &&
      addon.sourceURI?.spec === port.uri(proof.payload)
    );
  };
  const disableOwned = async (id: string) => {
    const current = await port.get(id);
    if (current && isOwned(current, id)) await current.disable();
  };
  const markConflict = (id: string) => {
    const entry = registry.entries.find((item) => item.id === id);
    if (entry) states.set(entry.payload.key, "conflict");
    if (mutation?.id === id) mutation.conflict = true;
  };
  const onNative = (event: NativeEvent, addon: NativeAddon) => {
    if (stopped) return;
    const entry = registry.entries.find((item) => item.id === addon.id);
    if (!entry && mutation?.id !== addon.id) return;
    if (mutation?.id === addon.id) {
      if (addon.sourceURI?.spec !== mutation.uri && !isOwned(addon, addon.id))
        markConflict(addon.id);
      return;
    }
    if (event === "installing" || event === "installed") {
      if (isOwned(addon, addon.id)) return;
      markConflict(addon.id);
    } else if (event === "enabled") {
      // Enabling through Firefox does not grant restart consent to this manager.
      return;
    }
    if (!entry) return;
    if (event === "disabled" && isOwned(addon, addon.id))
      states.set(entry.payload.key, "disabled");
    else if (event === "removed") states.set(entry.payload.key, "disabled");
    publish();
    void serialize(async () => {
      if (stopped) return;
      const latest = entryFor(entry.payload.key);
      if (!latest) return;
      await replace({
        ...latest,
        enabled: false,
        interrupted: !!latest.pending,
      });
    }).catch(report);
  };
  const loadWork = async (
    entry: Entry,
    active: () => boolean,
    reuse = false,
  ) => {
    if (!active() || !port.allowed())
      throw new LocalExtensionError("cancelled");
    await port.verify(entry.payload);
    if (!sameMetadata(entry, await port.inspect(entry.payload)))
      throw new LocalExtensionError("changed");
    let current = await port.get(entry.id);
    if (current && !isOwned(current, entry.id))
      throw new LocalExtensionError("conflict");
    const previous = entryFor(entry.payload.key);
    const checkpoint =
      previous && previous.payload.generation !== entry.payload.generation
        ? {
            ...previous,
            pending: entry.payload,
            enabled: false,
            interrupted: true,
          }
        : { ...entry, enabled: true, interrupted: true };
    await replace(checkpoint);
    if (!active()) throw new LocalExtensionError("cancelled");
    current = await port.get(entry.id);
    if (current && !isOwned(current, entry.id))
      throw new LocalExtensionError("conflict");
    states.set(entry.payload.key, "loading");
    publish();
    const operation = {
      id: entry.id,
      uri: port.uri(entry.payload),
      conflict: false,
    };
    mutation = operation;
    let installed: NativeAddon | undefined;
    try {
      if (reuse && current && current.sourceURI?.spec === operation.uri) {
        await current.enable();
        installed = current;
      } else installed = await port.install(entry.payload);
      const visible = await port.get(entry.id);
      if (
        installed.id !== entry.id ||
        !installed.temporarilyInstalled ||
        installed.sourceURI?.spec !== operation.uri ||
        visible !== installed
      )
        throw new LocalExtensionError("conflict");
      owned.set(entry.id, { addon: installed, payload: entry.payload });
      if (operation.conflict || !active() || !port.allowed()) {
        if (!shutdown) await disableOwned(entry.id);
        throw new LocalExtensionError(
          operation.conflict ? "conflict" : "cancelled",
        );
      }
      if (installed.appDisabled) throw new LocalExtensionError("incompatible");
      const { pending, ...confirmed } = entry;
      await replace({ ...confirmed, enabled: true, interrupted: false });
      if (pending) await port.remove(pending);
      states.set(entry.payload.key, "loaded");
    } catch (error) {
      const conflict =
        operation.conflict || failure(error).status === "conflict";
      states.set(entry.payload.key, conflict ? "conflict" : "failed");
      if (installed && !shutdown) await disableOwned(entry.id);
      if (!stopped) {
        const latest = entryFor(entry.payload.key);
        if (latest) {
          try {
            await replace({
              ...latest,
              enabled: false,
              interrupted: !!latest.pending || !conflict,
            });
          } catch (saveError) {
            report(saveError);
            throw new LocalExtensionError("partial");
          }
        }
      }
      throw error;
    } finally {
      mutation = null;
      publish();
    }
  };
  const load = async (entry: Entry, active: () => boolean, reuse = false) => {
    try {
      await loadWork(entry, active, reuse);
    } catch (error) {
      const result = failure(error).status;
      states.set(
        entry.payload.key,
        result === "conflict"
          ? "conflict"
          : result === "changed" || result === "corrupt"
            ? "corrupt"
            : "failed",
      );
      const latest = entryFor(entry.payload.key);
      if (!stopped && latest?.enabled)
        await replace({ ...latest, enabled: false });
      publish();
      throw error;
    }
  };
  const start = () => {
    initialization ??= serialize(async () => {
      try {
        if (stopped || !port.allowed()) {
          status = "unavailable";
          return;
        }
        await port.ready();
        if (stopped) return;
        raw = await port.read();
        registry = parseRegistry(raw);
        unlisten = port.listen(onNative);
        status = "ready";
        for (const entry of registry.entries)
          states.set(
            entry.payload.key,
            entry.interrupted
              ? "interrupted"
              : entry.enabled
                ? "waiting"
                : "disabled",
          );
        publish();
        if (!port.enabled()) return;
        busy = true;
        for (const entry of [...registry.entries]) {
          if (stopped || !port.enabled() || !port.allowed()) break;
          if (!entry.enabled || entry.interrupted) continue;
          try {
            await load(entry, () => !stopped && port.enabled());
          } catch (error) {
            states.set(
              entry.payload.key,
              failure(error).status === "conflict" ? "conflict" : "failed",
            );
            report(error);
          }
        }
      } catch (error) {
        status = "recovery";
        report(error);
      } finally {
        busy = false;
        publish();
      }
    });
    return initialization;
  };

  function session(
    window: object,
    isPrivate: boolean,
    signal: AbortSignal,
  ): LocalExtensionsBridge {
    let alive = true;
    let generation = 0;
    let prepared: Prepared | null = null;
    let selection: AbortController | null = null;
    const tokens = new Map<string, { key: string; revision: number }>();
    const rowTokens = new Map<string, string>();
    let tokenRevision = -1;
    const listeners = new Set<(snapshot: LocalExtensionsSnapshot) => void>();
    const snapshot = (): LocalExtensionsSnapshot => {
      if (tokenRevision !== registry.revision) {
        tokens.clear();
        rowTokens.clear();
        tokenRevision = registry.revision;
      }
      return copyLocalExtensionsSnapshot({
        status: !alive ? "unavailable" : isPrivate ? "private" : status,
        enabled: !isPrivate && port.enabled(),
        busy: !isPrivate && busy,
        rows:
          isPrivate || !alive
            ? []
            : registry.entries.map((entry) => {
                const key = entry.payload.key;
                let token = rowTokens.get(key);
                if (!token) {
                  token = port.uuid();
                  rowTokens.set(key, token);
                }
                tokens.set(token, { key, revision: registry.revision });
                return {
                  token,
                  name: entry.name,
                  version: entry.version,
                  enabled: entry.enabled,
                  state:
                    states.get(key) ?? (entry.enabled ? "waiting" : "disabled"),
                };
              }),
      });
    };
    const notify = () => {
      if (!alive) return;
      const value = snapshot();
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (error) {
          listeners.delete(listener);
          report(error);
        }
      }
    };
    const discard = async () => {
      const pending = prepared;
      prepared = null;
      if (pending) {
        await port.remove(pending.payload);
        staged.delete(pending.payload.generation);
      }
    };
    const cancel = () => {
      generation++;
      selection?.abort();
      selection = null;
      return serialize(discard)
        .then(() => ({ status: "cancelled" }) as LocalExtensionResult)
        .catch((error) => {
          report(error);
          return failure(error);
        });
    };
    const dispose = () => {
      if (!alive) return;
      alive = false;
      signal.removeEventListener("abort", dispose);
      subscribers.delete(notify);
      sessions.delete(dispose);
      listeners.clear();
      tokens.clear();
      rowTokens.clear();
      void cancel();
    };
    sessions.add(dispose);
    signal.addEventListener("abort", dispose, { once: true });
    subscribers.add(notify);
    if (signal.aborted) dispose();
    else if (!isPrivate) void start();
    const run = async (
      input: LocalExtensionRequest,
    ): Promise<LocalExtensionResult> => {
      let request: LocalExtensionRequest;
      try {
        request = copyLocalExtensionRequest(input);
      } catch (error) {
        report(error);
        return { status: "invalid" };
      }
      if (!alive || isPrivate || stopped) return { status: "unavailable" };
      if (request.type === "cancel") return cancel();
      if (request.type === "open-addons" || request.type === "open-debugging") {
        try {
          port.open(window, request.type);
          return { status: "done" };
        } catch (error) {
          report(error);
          return failure(error);
        }
      }
      if (busy) return { status: "busy" };
      const inputToken = "token" in request ? request.token : undefined;
      const selected = inputToken ? tokens.get(inputToken) : undefined;
      const operation = ++generation;
      const active = () => alive && !stopped && operation === generation;
      return serialize(async () => {
        if (!active()) return { status: "cancelled" };
        if (status !== "ready" || !port.allowed())
          return { status: "unavailable" };
        busy = true;
        publish();
        try {
          if (selected && selected.revision !== registry.revision)
            throw new LocalExtensionError("changed");
          const entry = selected ? entryFor(selected.key) : undefined;
          if (request.type === "prepare") {
            if (inputToken && !entry) throw new LocalExtensionError("changed");
            if (entry?.pending) throw new LocalExtensionError("interrupted");
            if (!entry && registry.entries.length >= limits.entries)
              throw new LocalExtensionError("too-large");
            await discard();
            if (staged.size >= limits.entries)
              throw new LocalExtensionError("too-large");
            selection = new AbortController();
            const source = await port.choose(
              window,
              request.source,
              request.title,
              selection.signal,
            );
            selection = null;
            if (!source || !active()) return { status: "cancelled" };
            const payload = await port.stage(
              source,
              request.source,
              entry?.payload.key,
            );
            staged.add(payload.generation);
            try {
              const metadata = await port.inspect(payload);
              if (!active()) throw new LocalExtensionError("cancelled");
              if (entry && entry.id !== metadata.id)
                throw new LocalExtensionError("conflict");
              const duplicate = registry.entries.find(
                (item) =>
                  item.id === metadata.id && item.payload.key !== payload.key,
              );
              const current = await port.get(metadata.id);
              if (duplicate || (current && !isOwned(current, metadata.id)))
                throw new LocalExtensionError("conflict");
              prepared = {
                payload,
                metadata,
                revision: registry.revision,
                key: entry?.payload.key,
                token: port.uuid(),
              };
              return {
                status: "preview",
                token: prepared.token,
                name: metadata.name,
                version: metadata.version,
                update: !!entry,
                required: metadata.required,
                optional: metadata.optional,
              };
            } catch (error) {
              await port.remove(payload);
              staged.delete(payload.generation);
              throw error;
            }
          }
          if (request.type === "confirm") {
            const pending = prepared;
            if (
              !pending ||
              pending.token !== request.token ||
              pending.revision !== registry.revision
            )
              throw new LocalExtensionError("changed");
            prepared = null;
            staged.delete(pending.payload.generation);
            const old = pending.key ? entryFor(pending.key) : undefined;
            const next: Entry = {
              ...pending.metadata,
              payload: pending.payload,
              enabled: true,
              interrupted: false,
            };
            port.setEnabled(true);
            try {
              await load(next, active);
            } catch (error) {
              const saved = entryFor(next.payload.key);
              if (
                saved?.payload.generation !== next.payload.generation &&
                saved?.pending?.generation !== next.payload.generation
              )
                await port.remove(next.payload);
              throw error;
            }
            if (old) {
              try {
                await port.remove(old.payload);
              } catch (error) {
                report(error);
                return { status: "partial" };
              }
            }
            return { status: "done" };
          }
          if (request.type === "disable-all") {
            port.setEnabled(false);
            await save(
              registry.entries.map((item) => ({ ...item, enabled: false })),
            );
            for (const item of registry.entries) {
              mutation = {
                id: item.id,
                uri: port.uri(item.payload),
                conflict: false,
              };
              try {
                await disableOwned(item.id);
                states.set(item.payload.key, "disabled");
              } finally {
                mutation = null;
              }
            }
            return { status: "done" };
          }
          if (!entry) throw new LocalExtensionError("changed");
          if (request.type === "enable" || request.type === "reload") {
            port.setEnabled(true);
            await load(entry, active, request.type === "enable");
            return { status: "done" };
          }
          const current = await port.get(entry.id);
          if (current && !isOwned(current, entry.id))
            throw new LocalExtensionError("conflict");
          mutation = {
            id: entry.id,
            uri: port.uri(entry.payload),
            conflict: false,
          };
          try {
            await replace({ ...entry, enabled: false });
            const latest = await port.get(entry.id);
            if (
              mutation.conflict ||
              (latest && (!isOwned(latest, entry.id) || latest !== current))
            )
              throw new LocalExtensionError("conflict");
            if (latest)
              await (request.type === "remove"
                ? latest.uninstall()
                : latest.disable());
            states.set(entry.payload.key, "disabled");
            if (request.type === "remove") {
              owned.delete(entry.id);
              await port.remove(entry.payload);
              if (entry.pending) await port.remove(entry.pending);
              await save(
                registry.entries.filter(
                  (item) => item.payload.key !== entry.payload.key,
                ),
              );
              states.delete(entry.payload.key);
              rowTokens.delete(entry.payload.key);
            }
          } finally {
            mutation = null;
          }
          return { status: "done" };
        } catch (error) {
          report(error);
          return failure(error);
        } finally {
          busy = false;
          publish();
        }
      });
    };
    return Object.freeze({
      snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      request: run,
    });
  }
  return {
    session,
    async stop(applicationShutdown = false) {
      if (stopped) return;
      shutdown = applicationShutdown;
      stopped = true;
      unlisten?.();
      unlisten = null;
      for (const dispose of [...sessions]) dispose();
      subscribers.clear();
      await queue;
      if (!shutdown)
        for (const id of owned.keys()) {
          try {
            await disableOwned(id);
          } catch (error) {
            report(error);
          }
        }
      owned.clear();
    },
  };
}
