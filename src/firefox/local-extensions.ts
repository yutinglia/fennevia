// SPDX-License-Identifier: MPL-2.0
import type { LocalExtensionsBridge } from "../app/local-extensions.ts";
import { createNativeLocalExtensionPort } from "./local-extensions/native.ts";
import { createLocalExtensionService } from "./local-extensions/service.ts";
import { LocalExtensionError } from "./local-extensions/model.ts";

export function createFirefoxLocalExtensionsRuntime(
  diagnostic: (error: unknown, symbol?: string) => void,
) {
  const report = (error: unknown) =>
    diagnostic(
      error,
      error instanceof LocalExtensionError ? error.symbol : undefined,
    );
  let service: ReturnType<typeof createLocalExtensionService> | null = null;
  let failed = false;
  let stopped = false;
  let pendingStop: Promise<void> | null = null;
  let removeBlocker: (() => void) | null = null;
  const stop = (applicationShutdown: boolean) => {
    stopped = true;
    pendingStop ??= (
      service?.stop(applicationShutdown) ?? Promise.resolve()
    ).finally(() => {
      removeBlocker?.();
      removeBlocker = null;
    });
    return pendingStop;
  };
  return {
    forWindow(
      context: Readonly<{
        window: object;
        isPrivate: boolean;
        signal: AbortSignal;
      }>,
    ): LocalExtensionsBridge | undefined {
      if (stopped || failed || context.isPrivate) return undefined;
      try {
        if (!service) {
          // DOM APIs captured from a browser window still create promises in
          // that window's global. Use this system module's process global so
          // closing the first window cannot strand pending filesystem work.
          const port = createNativeLocalExtensionPort(globalThis);
          service = createLocalExtensionService(port, report);
          const environment = globalThis as unknown as {
            IOUtils?: {
              profileBeforeChange?: {
                addBlocker(name: string, blocker: () => Promise<void>): void;
                removeBlocker(blocker: () => Promise<void>): void;
              };
            };
          };
          const phase = environment.IOUtils?.profileBeforeChange;
          if (
            !phase ||
            typeof phase.addBlocker !== "function" ||
            typeof phase.removeBlocker !== "function"
          )
            throw new LocalExtensionError(
              "unavailable",
              "IOUtils.profileBeforeChange",
            );
          const blocker = () => stop(true);
          phase.addBlocker("Fennevia local extension cleanup", blocker);
          removeBlocker = () => phase.removeBlocker(blocker);
        }
        return service.session(context.window, false, context.signal);
      } catch (error) {
        failed = true;
        report(error);
        void stop(false).catch(report);
        return undefined;
      }
    },
    stop,
  };
}
