const ROOT_STATE_ATTRIBUTE = "data-fennevia-state";
const STATE_MARKER_ATTRIBUTES = Object.freeze({
  active: "data-fennevia-active",
  created: "data-fennevia-created",
  failed: "data-fennevia-failed",
  healthy: "data-fennevia-healthy",
  mounted: "data-fennevia-mounted",
});

const ALL_STATE_ATTRIBUTES = Object.freeze([
  ROOT_STATE_ATTRIBUTE,
  ...Object.values(STATE_MARKER_ATTRIBUTES),
]);

const MARKERS_BY_STATE = Object.freeze({
  active: Object.freeze([
    STATE_MARKER_ATTRIBUTES.created,
    STATE_MARKER_ATTRIBUTES.mounted,
    STATE_MARKER_ATTRIBUTES.healthy,
    STATE_MARKER_ATTRIBUTES.active,
  ]),
  created: Object.freeze([STATE_MARKER_ATTRIBUTES.created]),
  failed: Object.freeze([STATE_MARKER_ATTRIBUTES.failed]),
  healthy: Object.freeze([
    STATE_MARKER_ATTRIBUTES.created,
    STATE_MARKER_ATTRIBUTES.mounted,
    STATE_MARKER_ATTRIBUTES.healthy,
  ]),
  mounted: Object.freeze([
    STATE_MARKER_ATTRIBUTES.created,
    STATE_MARKER_ATTRIBUTES.mounted,
  ]),
});

const NEXT_STATE = Object.freeze({
  created: "mounted",
  mounted: "healthy",
  healthy: "active",
});

const EMERGENCY_FALLBACK_BINDING = "Ctrl+Alt+Shift+F12";
const EMERGENCY_LISTENER_OPTIONS = Object.freeze({
  capture: true,
  mozSystemGroup: true,
});
const MAX_HEALTH_TIMEOUT_MS = 30_000;

const defineErrorContext = (error, { code, phase, capability }) => {
  for (const [property, value] of [
    ["fenneviaCode", code],
    ["fenneviaPhase", phase],
    ...(capability ? [["fenneviaCapability", capability]] : []),
  ]) {
    if (!Object.hasOwn(error, property)) {
      Object.defineProperty(error, property, {
        value,
        enumerable: false,
      });
    }
  }
  return error;
};

export function createShellLifecycleError(
  code,
  phase,
  { cause, capability } = {},
) {
  const error = new Error(code);
  error.name = "FenneviaShellLifecycleError";
  if (cause !== undefined) {
    Object.defineProperty(error, "cause", {
      value: cause,
      enumerable: false,
    });
  }
  return defineErrorContext(error, { code, phase, capability });
}

export function annotateShellLifecycleError(
  value,
  { code, phase, capability },
) {
  const error =
    value instanceof Error
      ? value
      : createShellLifecycleError(code, phase, {
          cause: value,
          capability,
        });
  try {
    return defineErrorContext(error, { code, phase, capability });
  } catch {
    return createShellLifecycleError(code, phase, {
      cause: error,
      capability,
    });
  }
}

const validateRootElement = (rootElement) => {
  if (
    typeof rootElement?.hasAttribute !== "function" ||
    typeof rootElement?.setAttribute !== "function" ||
    typeof rootElement?.removeAttribute !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_STATE_ROOT_INVALID",
      "shell-state-create",
    );
  }
};

const removeStateAttributes = (rootElement) => {
  let firstError;
  for (const attribute of ALL_STATE_ATTRIBUTES) {
    try {
      rootElement.removeAttribute(attribute);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) {
    throw firstError;
  }
};

const applyStateAttributes = (rootElement, state) => {
  removeStateAttributes(rootElement);
  rootElement.setAttribute(ROOT_STATE_ATTRIBUTE, state);
  for (const attribute of MARKERS_BY_STATE[state]) {
    rootElement.setAttribute(attribute, "");
  }
};

export function createShellHealthState({ rootElement }) {
  validateRootElement(rootElement);

  const collision = ALL_STATE_ATTRIBUTES.find((attribute) =>
    rootElement.hasAttribute(attribute),
  );
  if (collision) {
    try {
      removeStateAttributes(rootElement);
    } catch {
      try {
        rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
      } catch {
        // The caller reports the original collision. The ordinary DOM path
        // cannot throw here, and cleanup gets another exact-attribute pass.
      }
    }
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_STATE_ATTRIBUTE_COLLISION",
      "shell-state-create",
    );
  }

  let state = "created";
  try {
    applyStateAttributes(rootElement, state);
  } catch (error) {
    try {
      rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
    } catch {
      // The decorated state-creation error remains the causal failure.
    }
    throw annotateShellLifecycleError(error, {
      code: "FENNEVIA_SHELL_STATE_ATTRIBUTE_FAILED",
      phase: "shell-state-create",
    });
  }

  const controller = {
    transition(nextState) {
      if (state === nextState) {
        return false;
      }
      if (state === "disposed") {
        throw createShellLifecycleError(
          "FENNEVIA_SHELL_STATE_DISPOSED",
          "shell-state-transition",
        );
      }
      if (nextState === "failed") {
        return controller.fail();
      }
      if (NEXT_STATE[state] !== nextState) {
        const error = createShellLifecycleError(
          "FENNEVIA_SHELL_STATE_TRANSITION_INVALID",
          "shell-state-transition",
        );
        try {
          controller.fail();
        } catch {
          try {
            rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
          } catch {
            // The invalid transition remains the causal error.
          }
        }
        throw error;
      }

      try {
        applyStateAttributes(rootElement, nextState);
        state = nextState;
        return true;
      } catch (error) {
        try {
          controller.fail();
        } catch {
          try {
            rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
          } catch {
            // The attribute failure remains the causal error.
          }
        }
        throw annotateShellLifecycleError(error, {
          code: "FENNEVIA_SHELL_STATE_ATTRIBUTE_FAILED",
          phase: "shell-state-transition",
        });
      }
    },

    activate() {
      return controller.transition("active");
    },

    clearActive() {
      rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
    },

    fail() {
      if (state === "disposed" || state === "failed") {
        return false;
      }

      try {
        rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
      } finally {
        state = "failed";
      }
      try {
        applyStateAttributes(rootElement, state);
      } catch (error) {
        try {
          rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
        } catch {
          // Preserve the causal attribute error while still attempting the
          // fail-open active-gate removal first.
        }
        throw annotateShellLifecycleError(error, {
          code: "FENNEVIA_SHELL_STATE_ATTRIBUTE_FAILED",
          phase: "shell-state-fail",
        });
      }
      return true;
    },

    dispose() {
      if (state === "disposed") {
        return false;
      }

      const preserveFailedMarker = state === "failed";
      let firstError;
      try {
        rootElement.removeAttribute(STATE_MARKER_ATTRIBUTES.active);
      } catch (error) {
        firstError = error;
      }
      try {
        removeStateAttributes(rootElement);
      } catch (error) {
        firstError ??= error;
      }
      if (preserveFailedMarker) {
        try {
          rootElement.setAttribute(STATE_MARKER_ATTRIBUTES.failed, "");
        } catch (error) {
          firstError ??= error;
        }
      }
      state = "disposed";
      if (firstError) {
        throw annotateShellLifecycleError(firstError, {
          code: "FENNEVIA_SHELL_STATE_CLEANUP_FAILED",
          phase: "shell-state-dispose",
        });
      }
      return true;
    },

    snapshot() {
      return Object.freeze({
        active:
          state === "active" &&
          rootElement.hasAttribute(STATE_MARKER_ATTRIBUTES.active),
        state,
      });
    },
  };

  return Object.freeze(controller);
}

export function isEmergencyFallbackEvent(event) {
  const isF12 =
    event?.code === "F12" || event?.key === "F12" || event?.keyCode === 0x7b;
  return Boolean(
    isF12 &&
    event.altKey === true &&
    event.ctrlKey === true &&
    event.shiftKey === true &&
    event.metaKey !== true,
  );
}

export function registerEmergencyFallback({
  eventTarget,
  onFallback,
  onError,
}) {
  if (
    typeof eventTarget?.addEventListener !== "function" ||
    typeof eventTarget?.removeEventListener !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_EMERGENCY_EVENT_TARGET_INVALID",
      "shell-emergency-register",
    );
  }
  if (typeof onFallback !== "function" || typeof onError !== "function") {
    throw createShellLifecycleError(
      "FENNEVIA_EMERGENCY_CALLBACK_INVALID",
      "shell-emergency-register",
    );
  }

  let registered = false;
  let invocationCount = 0;
  const onKeyDown = (event) => {
    if (!isEmergencyFallbackEvent(event)) {
      return;
    }

    event.preventDefault?.();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    } else {
      event.stopPropagation?.();
    }
    invocationCount += 1;
    try {
      const result = onFallback();
      if (result && typeof result.then === "function") {
        throw createShellLifecycleError(
          "FENNEVIA_EMERGENCY_FALLBACK_ASYNC",
          "shell-emergency-fallback",
        );
      }
    } catch (error) {
      onError(
        annotateShellLifecycleError(error, {
          code: "FENNEVIA_EMERGENCY_FALLBACK_FAILED",
          phase: "shell-emergency-fallback",
        }),
      );
    }
  };

  eventTarget.addEventListener(
    "keydown",
    onKeyDown,
    EMERGENCY_LISTENER_OPTIONS,
  );
  registered = true;

  return Object.freeze({
    dispose() {
      if (!registered) {
        return false;
      }
      registered = false;
      eventTarget.removeEventListener(
        "keydown",
        onKeyDown,
        EMERGENCY_LISTENER_OPTIONS,
      );
      return true;
    },

    snapshot() {
      return Object.freeze({
        binding: EMERGENCY_FALLBACK_BINDING,
        invocationCount,
        registered,
      });
    },
  });
}

export async function runShellHealthCheck({
  check,
  signal,
  timeoutMs,
  setTimeoutFunction = globalThis.setTimeout,
  clearTimeoutFunction = globalThis.clearTimeout,
}) {
  if (typeof check !== "function") {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_HEALTH_CHECK_INVALID",
      "shell-health-check",
    );
  }
  if (
    !signal ||
    typeof signal.addEventListener !== "function" ||
    typeof signal.removeEventListener !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_HEALTH_SIGNAL_INVALID",
      "shell-health-check",
    );
  }
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_HEALTH_TIMEOUT_MS ||
    typeof setTimeoutFunction !== "function" ||
    typeof clearTimeoutFunction !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_HEALTH_TIMEOUT_INVALID",
      "shell-health-check",
    );
  }
  if (signal.aborted) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_HEALTH_ABORTED",
      "shell-health-check",
    );
  }

  let timeoutId;
  let onAbort;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeoutFunction(() => {
      reject(
        createShellLifecycleError(
          "FENNEVIA_SHELL_HEALTH_TIMEOUT",
          "shell-health-timeout",
        ),
      );
    }, timeoutMs);
  });
  const aborted = new Promise((_, reject) => {
    onAbort = () => {
      reject(
        createShellLifecycleError(
          "FENNEVIA_SHELL_HEALTH_ABORTED",
          "shell-health-check",
        ),
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  const checked = Promise.resolve().then(() => check({ signal }));

  try {
    const result = await Promise.race([checked, timeout, aborted]);
    if (result !== true) {
      throw createShellLifecycleError(
        result === false
          ? "FENNEVIA_SHELL_HEALTH_CHECK_FAILED"
          : "FENNEVIA_SHELL_HEALTH_RESULT_INVALID",
        "shell-health-check",
      );
    }
    return true;
  } finally {
    clearTimeoutFunction(timeoutId);
    signal.removeEventListener("abort", onAbort);
  }
}

export const emergencyFallbackBinding = EMERGENCY_FALLBACK_BINDING;
export const shellHealthAttributes = Object.freeze({
  rootState: ROOT_STATE_ATTRIBUTE,
  ...STATE_MARKER_ATTRIBUTES,
});
