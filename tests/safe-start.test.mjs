import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const configSource = readFileSync(
  new URL("../program/fennevia.cfg", import.meta.url),
  "utf8"
);

const runAutoConfig = ({
  inSafeMode = false,
  safeStart = false,
  importMode = "valid",
} = {}) => {
  const calls = [];
  const messages = [];
  const manifest = {
    append(segment) {
      calls.push(`manifest.append:${segment}`);
    },
    exists() {
      calls.push("manifest.exists");
      return true;
    },
    isFile() {
      calls.push("manifest.isFile");
      return true;
    },
  };
  const context = vm.createContext({
    Services: {
      appinfo: {
        appBuildID: "20260810162159",
        inSafeMode,
        version: "153.0.4",
      },
      console: {
        logStringMessage(message) {
          messages.push(message);
        },
      },
      dirsvc: {
        get() {
          calls.push("dirsvc.get");
          return manifest;
        },
      },
      io: {
        newURI(uri) {
          calls.push(`io.newURI:${uri}`);
          return { uri };
        },
      },
      prefs: {
        getBoolPref(name, fallback) {
          calls.push(`prefs.getBoolPref:${name}:${fallback}`);
          return safeStart;
        },
      },
    },
    Ci: {
      nsIChromeRegistry: "nsIChromeRegistry",
      nsIComponentRegistrar: "nsIComponentRegistrar",
      nsIFile: "nsIFile",
    },
    Cc: {
      "@mozilla.org/chrome/chrome-registry;1": {
        getService() {
          calls.push("chromeRegistry.getService");
          return {
            convertChromeURL() {
              calls.push("chromeRegistry.convertChromeURL");
            },
          };
        },
      },
    },
    Components: {
      manager: {
        QueryInterface() {
          calls.push("registrar.QueryInterface");
          return {
            autoRegister() {
              calls.push("registrar.autoRegister");
            },
          };
        },
      },
    },
    ChromeUtils: {
      importESModule(uri) {
        calls.push(`ChromeUtils.importESModule:${uri}`);
        if (importMode === "broken") {
          throw new Error("injected broken bundle");
        }
        return {
          bootstrapResult: {
            schemaVersion: 1,
            status: "ready",
            initializationCount: 1,
          },
        };
      },
    },
  });

  vm.runInContext(configSource, context, {
    filename: "fennevia.cfg",
  });
  return {
    calls,
    records: messages.map(message =>
      JSON.parse(message.replace(/^\[Fennevia bootstrap\] /u, ""))
    ),
  };
};

test("the project safe-start preference exits before manifest or bundle access", async t => {
  for (const importMode of ["valid", "broken"]) {
    await t.test(`${importMode} installed bundle`, () => {
      const result = runAutoConfig({ safeStart: true, importMode });
      assert.deepEqual(
        result.records.map(record => ({
          event: record.event,
          phase: record.phase,
          result: record.result,
          code: record.code,
        })),
        [
          {
            event: "bootstrap.skipped",
            phase: "preflight",
            result: "safe-start",
            code: "FENNEVIA_BOOTSTRAP_SAFE_START",
          },
        ]
      );
      assert.ok(
        result.calls.every(
          call =>
            !call.startsWith("dirsvc.") &&
            !call.startsWith("manifest.") &&
            !call.startsWith("registrar.") &&
            !call.startsWith("chromeRegistry.") &&
            !call.startsWith("ChromeUtils.")
        )
      );
      assert.deepEqual(result.calls, [
        "prefs.getBoolPref:fennevia.safeStart:false",
      ]);
    });
  }
});

test("Firefox safe mode exits before even reading the project preference", () => {
  const result = runAutoConfig({ inSafeMode: true, importMode: "broken" });
  assert.equal(result.records[0].event, "bootstrap.skipped");
  assert.equal(result.records[0].result, "safe-start");
  assert.deepEqual(result.calls, []);
});

test("ordinary startup still registers and validates one privileged entry module", () => {
  const result = runAutoConfig();
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].event, "bootstrap.success");
  assert.equal(result.records[0].result, "ready");
  assert.equal(
    result.calls.filter(call => call === "registrar.autoRegister").length,
    1
  );
  assert.equal(
    result.calls.filter(call =>
      call.startsWith("ChromeUtils.importESModule:chrome://fennevia/")
    ).length,
    1
  );
});

test("a broken bundle outside safe start remains a caught fatal bootstrap", () => {
  const result = runAutoConfig({ importMode: "broken" });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].event, "bootstrap.fatal");
  assert.equal(result.records[0].phase, "entry-import");
  assert.equal(result.records[0].result, "failed");
  assert.equal(result.records[0].code, "FENNEVIA_BOOTSTRAP_FATAL");
});
