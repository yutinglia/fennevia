import {
  getShellAppCapabilities,
  mountShellApp,
  verifyShellAppHealth,
} from "./index";

const registration = (
  globalThis as typeof globalThis & {
    __fenneviaRegisterShellFrontend?: (api: {
      getShellAppCapabilities: typeof getShellAppCapabilities;
      mountShellApp: typeof mountShellApp;
      verifyShellAppHealth: typeof verifyShellAppHealth;
    }) => void;
  }
).__fenneviaRegisterShellFrontend;

if (typeof registration !== "function") {
  throw new Error("FENNEVIA_FRONTEND_REGISTRATION_UNAVAILABLE");
}

registration(
  Object.freeze({
    getShellAppCapabilities,
    mountShellApp,
    verifyShellAppHealth,
  }),
);
