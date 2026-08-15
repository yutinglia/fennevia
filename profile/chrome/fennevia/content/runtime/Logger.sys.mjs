const LOG_PREFIX = "[Fennevia runtime]";

const STABLE_TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,95}$/u;
const ERROR_CODE_PATTERN = /^FENNEVIA_[A-Z0-9_]{1,95}$/u;
const OPAQUE_ID_PATTERN = /^window-[a-z0-9-]{1,64}$/u;
const PROJECT_URI_PATTERN =
  /^chrome:\/\/fennevia\/[A-Za-z0-9._~!$&'()*+,;=:@\/-]{1,240}$/u;
const PROJECT_COMMIT_PATTERN = /^(?:[0-9a-f]{7,40}|unknown)$/u;
const APP_METADATA_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/u;

const normalizeStableToken = (value, fallback) => {
  const candidate = typeof value === "string" ? value : "";
  return STABLE_TOKEN_PATTERN.test(candidate) ? candidate : fallback;
};

const normalizeErrorCode = value => {
  const candidate = typeof value === "string" ? value : "";
  return ERROR_CODE_PATTERN.test(candidate)
    ? candidate
    : "FENNEVIA_RUNTIME_INVALID_CODE";
};

const safeErrorName = error => {
  const name = typeof error?.name === "string" ? error.name : "Error";
  return STABLE_TOKEN_PATTERN.test(name) ? name : "UnsafeErrorName";
};

const redactStackLine = line =>
  String(line)
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\b(?:https?|wss?|ftp):\/\/.*$/giu, "<REMOTE_URL>")
    .replace(/\b(?:jar:)?file:\/{2,3}.*$/giu, "<LOCAL_FILE>")
    .replace(/\b(?:data|blob):.*$/giu, "<OPAQUE_URL>")
    .replace(/\\\\.*$/gu, "<UNC_PATH>")
    .replace(/\b[A-Za-z]:[\\/].*$/gu, "<LOCAL_PATH>")
    .replace(
      /(^|[\s(@])\/(?!\/)[^\s)>\]]+(?=[)>\]]?\s*$)/gu,
      "$1<LOCAL_PATH>"
    )
    .replace(
      /\b((?:chrome|resource):\/\/[^\s?#)>\]]+)[?#][^\s)>\]]*/giu,
      "$1<REDACTED_SUFFIX>"
    )
    .replace(
      /\b(?!(?:chrome|resource):)[A-Za-z][A-Za-z0-9+.-]*:.*$/giu,
      "<OTHER_URI>"
    )
    .slice(0, 1000);

const isStackFrame = line =>
  /(?:^\s*at\s+.*(?:\(|\s)|@)(?:(?:https?|file|chrome|resource|data|blob):|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|tmp|var|opt|private|Applications)\/)/iu.test(
    String(line)
  );

const safeStack = error => {
  const rawStack = typeof error?.stack === "string" ? error.stack : "";
  if (!rawStack) {
    return ["<NO_STACK_AVAILABLE>"];
  }

  const lines = rawStack.split(/\r\n|\n|\r/u);
  return lines.map((line, index) => {
    if (index === 0 && !isStackFrame(line)) {
      return `${safeErrorName(error)}: <REDACTED_MESSAGE>`;
    }
    return redactStackLine(line);
  });
};

const normalizeWindowKind = value =>
  value === "normal" || value === "private" || value === "unsupported"
    ? value
    : undefined;

export function createRuntimeLogger({
  consoleService,
  appInfo,
  projectCommit = "unknown",
}) {
  if (typeof consoleService?.logStringMessage !== "function") {
    throw new Error("FENNEVIA_LOGGER_CONSOLE_UNAVAILABLE");
  }
  if (!appInfo) {
    throw new Error("FENNEVIA_LOGGER_APP_INFO_UNAVAILABLE");
  }

  const firefoxVersion = APP_METADATA_PATTERN.test(String(appInfo.version))
    ? String(appInfo.version)
    : "unknown";
  const buildId = APP_METADATA_PATTERN.test(String(appInfo.appBuildID))
    ? String(appInfo.appBuildID)
    : "unknown";
  const commit = PROJECT_COMMIT_PATTERN.test(projectCommit)
    ? projectCommit
    : "unknown";

  const write = (level, fields) => {
    const record = {
      schemaVersion: 1,
      level:
        level === "debug" || level === "info" || level === "warn"
          ? level
          : "error",
      event: normalizeStableToken(fields?.event, "runtime.invalid-event"),
      phase: normalizeStableToken(fields?.phase, "runtime"),
      code: normalizeErrorCode(fields?.code),
      projectCommit: commit,
      firefoxVersion,
      buildId,
    };

    const windowKind = normalizeWindowKind(fields?.windowKind);
    if (windowKind) {
      record.windowKind = windowKind;
    }

    if (
      typeof fields?.opaqueId === "string" &&
      OPAQUE_ID_PATTERN.test(fields.opaqueId)
    ) {
      record.opaqueId = fields.opaqueId;
    }

    if (
      typeof fields?.projectUri === "string" &&
      PROJECT_URI_PATTERN.test(fields.projectUri)
    ) {
      record.projectUri = fields.projectUri;
    }

    if (
      typeof fields?.capability === "string" &&
      STABLE_TOKEN_PATTERN.test(fields.capability) &&
      typeof fields.available === "boolean"
    ) {
      record.capability = fields.capability;
      record.available = fields.available;
    }

    if (fields?.error) {
      try {
        record.errorName = safeErrorName(fields.error);
        record.stack = safeStack(fields.error);
      } catch {
        // A redaction failure intentionally leaves a minimal code-only record.
      }
    }

    consoleService.logStringMessage(`${LOG_PREFIX} ${JSON.stringify(record)}`);
  };

  return Object.freeze({
    debug(fields) {
      write("debug", fields);
    },
    info(fields) {
      write("info", fields);
    },
    warn(fields) {
      write("warn", fields);
    },
    error(fields) {
      write("error", fields);
    },
  });
}
