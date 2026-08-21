// SPDX-License-Identifier: MPL-2.0

export const createToolbarWidgetsStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaToolbarWidgetsStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "toolbar-widgets-state" },
  });
  return error;
};
