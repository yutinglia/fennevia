// SPDX-License-Identifier: MPL-2.0
import { readFile } from "node:fs/promises";
import path from "node:path";

const importPattern = /^@import "\.\/([a-z-]+\.css)";$/gmu;

/** @param {string} projectRoot */
export async function readShellStyles(projectRoot) {
  const stylesRoot = path.join(projectRoot, "src", "shell", "styles");
  const barrel = await readFile(
    path.join(stylesRoot, "edge-shell.css"),
    "utf8",
  );
  const files = [...barrel.matchAll(importPattern)].map((match) => match[1]);
  if (files.length === 0) {
    throw new Error("FENNEVIA_TEST_SHELL_STYLE_INVENTORY_EMPTY");
  }
  const modules = await Promise.all(
    files.map((file) => readFile(path.join(stylesRoot, file), "utf8")),
  );
  return [barrel, ...modules].join("\n");
}
