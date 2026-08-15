import { flushSync, mount, unmount } from "svelte";

import App from "./App.svelte";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const MOUNT_STATUS_ATTRIBUTE = "data-fennevia-framework-status";
const ROOT_SELECTOR = "#fennevia-shell-app-root[data-fennevia-smoke-root]";

export type ShellWindowKind = "normal" | "private";

type MountOptions = Readonly<{
  onUnmountError: (error: unknown) => void;
  target: Element;
  windowKind: ShellWindowKind;
}>;

type HealthOptions = Readonly<{
  target: Element;
  windowKind: ShellWindowKind;
}>;

const mountedTargets = new WeakSet<Element>();

function createFrontendError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaFrontendError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "shell-frontend" },
  });
  return error;
}

function validateTarget(target: Element): void {
  if (
    target.namespaceURI !== XHTML_NAMESPACE ||
    target.id !== "fennevia-shell-app-mount" ||
    target.childNodes.length !== 0 ||
    mountedTargets.has(target)
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_TARGET_INVALID");
  }
}

function isWindowKind(value: string): value is ShellWindowKind {
  return value === "normal" || value === "private";
}

export function mountShellApp({
  onUnmountError,
  target,
  windowKind,
}: MountOptions): () => boolean {
  if (typeof onUnmountError !== "function" || !isWindowKind(windowKind)) {
    throw createFrontendError("FENNEVIA_FRONTEND_OPTIONS_INVALID");
  }
  validateTarget(target);

  let disposed = false;
  target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounting");
  try {
    const component = mount(App, {
      props: {
        onDisposed() {
          target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "disposed");
        },
        windowKind,
      },
      target,
    });
    flushSync();
    mountedTargets.add(target);
    target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounted");

    return () => {
      if (disposed) {
        return false;
      }
      disposed = true;

      let unmountResult: Promise<void> | undefined;
      try {
        unmountResult = unmount(component, { outro: false });
        flushSync();
      } finally {
        mountedTargets.delete(target);
        target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "disposed");
      }

      void unmountResult?.catch(onUnmountError);
      if (target.childNodes.length !== 0) {
        throw createFrontendError("FENNEVIA_FRONTEND_UNMOUNT_INCOMPLETE");
      }
      return true;
    };
  } catch (error) {
    mountedTargets.delete(target);
    target.replaceChildren();
    target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "failed");
    throw error;
  }
}

export function verifyShellAppHealth({
  target,
  windowKind,
}: HealthOptions): true {
  const root = target.querySelector(ROOT_SELECTOR);
  const template = root?.querySelector<HTMLTemplateElement>(
    "template[data-fennevia-template]",
  );
  const documentView = target.ownerDocument.defaultView;
  const templateConstructor = documentView?.HTMLTemplateElement;
  const templateContent = template?.content?.firstElementChild;
  const requiredSelectors = [
    'button[data-fennevia-action="increment"]',
    'button[data-fennevia-action="toggle-details"]',
    "input[data-fennevia-input]",
    "output[data-fennevia-counter]",
    "[data-fennevia-conditional]",
  ];

  if (
    target.getAttribute(MOUNT_STATUS_ATTRIBUTE) !== "mounted" ||
    !root ||
    root.parentElement !== target ||
    root.namespaceURI !== XHTML_NAMESPACE ||
    root.getAttribute("data-fennevia-window-kind") !== windowKind ||
    !template ||
    typeof templateConstructor !== "function" ||
    !(template instanceof templateConstructor) ||
    template.namespaceURI !== XHTML_NAMESPACE ||
    templateContent?.namespaceURI !== XHTML_NAMESPACE ||
    requiredSelectors.some((selector) => !root.querySelector(selector)) ||
    Array.from(root.querySelectorAll("*")).some(
      (element) => element.namespaceURI !== XHTML_NAMESPACE,
    )
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_HEALTH_INVALID");
  }
  return true;
}

export function getShellAppCapabilities({
  target,
  windowKind,
}: HealthOptions): ReadonlyArray<
  Readonly<{ available: boolean; name: string }>
> {
  const view = target.ownerDocument.defaultView;
  return Object.freeze([
    Object.freeze({
      available:
        target.getAttribute(MOUNT_STATUS_ATTRIBUTE) === "mounted" &&
        target.querySelector(ROOT_SELECTOR) !== null,
      name: "frontend.svelte-root",
    }),
    Object.freeze({
      available:
        typeof view?.HTMLTemplateElement === "function" &&
        target.querySelector("template[data-fennevia-template]") instanceof
          view.HTMLTemplateElement,
      name: "dom.html-template-element",
    }),
    Object.freeze({
      available: isWindowKind(windowKind),
      name: "frontend.per-window-state",
    }),
  ]);
}
