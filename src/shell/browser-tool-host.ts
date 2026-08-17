const BROWSER_TOOL_HOST_SELECTOR = "[data-fennevia-browser-tool]";

const isHostElement = (
  value: unknown,
): value is Element & { closest: (selector: string) => Element | null } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Element).getBoundingClientRect === "function";

export function resolveBrowserToolHost(event: Event | undefined): unknown {
  if (!event || typeof event !== "object") {
    return undefined;
  }
  for (const origin of [event.target, event.currentTarget]) {
    if (
      typeof origin !== "object" ||
      origin === null ||
      typeof (origin as Element).closest !== "function"
    ) {
      continue;
    }
    let host: unknown;
    try {
      host = Reflect.apply((origin as Element).closest, origin, [
        BROWSER_TOOL_HOST_SELECTOR,
      ]);
    } catch {
      continue;
    }
    if (isHostElement(host)) {
      return host;
    }
  }
  return undefined;
}
