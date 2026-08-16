// SPDX-License-Identifier: MPL-2.0

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");

const normalizeLines = (value) => value.replaceAll("\r\n", "\n");

test("the repository carries the unmodified canonical MPL-2.0 text", async () => {
  const license = normalizeLines(await readProjectFile("LICENSE"));
  const digest = createHash("sha256").update(license).digest("hex");

  assert.equal(
    digest,
    "3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04",
  );
  assert.match(license, /^Mozilla Public License Version 2\.0$/mu);
  assert.match(license, /^Exhibit A - Source Code Form License Notice$/mu);
  assert.match(
    license,
    /This Source Code Form is "Incompatible With Secondary Licenses"/u,
  );
});

test("package and current project documents declare the approved license", async () => {
  const [packageJson, packageLock, readme, contributing, agents, policy] =
    await Promise.all([
      readProjectFile("package.json").then(JSON.parse),
      readProjectFile("package-lock.json").then(JSON.parse),
      readProjectFile("README.md"),
      readProjectFile("CONTRIBUTING.md"),
      readProjectFile("AGENTS.md"),
      readProjectFile("docs/licensing-and-provenance.md"),
    ]);

  assert.equal(packageJson.license, "MPL-2.0");
  assert.equal(packageLock.packages[""].license, "MPL-2.0");
  assert.equal(packageJson.private, true);
  assert.match(readme, /\[MPL-2\.0\]\(LICENSE\)/u);
  assert.doesNotMatch(readme, /Project license\s+\| Pending/u);
  assert.doesNotMatch(
    contributing,
    /currently has no selected project license/u,
  );
  assert.match(contributing, /contribution under MPL-2\.0/u);
  assert.match(agents, /docs\/licensing-and-provenance\.md/u);
  assert.match(policy, /Copyright 2026 Fennevia contributors\./u);
  assert.match(policy, /No contributor license\s+agreement/u);
  assert.match(policy, /does not grant rights to contributor trademarks/u);
});

test("third-party provenance identifies the only bundled runtime", async () => {
  const [notices, generatedNotice, policy] = await Promise.all([
    readProjectFile("THIRD_PARTY_NOTICES.md"),
    readProjectFile(
      "profile/chrome/fennevia/content/shell/THIRD_PARTY_NOTICES.txt",
    ),
    readProjectFile("docs/licensing-and-provenance.md"),
  ]);

  assert.match(notices, /Svelte 5\.56\.9 runtime subset/u);
  assert.match(notices, /20b341f10048cf1016a2028ac7eee5595cfef6a5/u);
  assert.match(notices, /sha512-VT8kSnlEg8069w7A/u);
  assert.match(notices, /License: MIT/u);
  assert.match(notices, /THIRD_PARTY_NOTICES\.txt/u);
  assert.match(notices, /no copied\/adapted\s+implementation/iu);
  assert.match(generatedNotice, /Package: svelte@5\.56\.9/u);
  assert.match(
    generatedNotice,
    /Copyright \(c\) 2016-2025 Svelte Contributors/u,
  );
  assert.match(policy, /source repository and exact source file/u);
  assert.match(policy, /Unlicensed, unclear, source-visible-only/u);
});
