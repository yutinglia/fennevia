import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const TIMEOUT_MS = 30_000;

function readArguments(argv) {
  const options = new Map();

  if (argv.length % 2 !== 0) {
    throw new Error(
      "Usage: node tests/bootstrap-content-access.mjs --firefox <absolute-path> --profile <absolute-path> --screenshot <absolute-path>"
    );
  }

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      !["--firefox", "--profile", "--screenshot"].includes(name) ||
      !value ||
      options.has(name)
    ) {
      throw new Error(
        "Usage: node tests/bootstrap-content-access.mjs --firefox <absolute-path> --profile <absolute-path> --screenshot <absolute-path>"
      );
    }
    options.set(name, value);
  }

  const firefox = options.get("--firefox");
  const profile = options.get("--profile");
  const screenshot = options.get("--screenshot");
  for (const [name, value] of [
    ["--firefox", firefox],
    ["--profile", profile],
    ["--screenshot", screenshot],
  ]) {
    if (!value || !isAbsolute(value)) {
      throw new Error(`${name} must be an absolute path.`);
    }
  }

  return { firefox, profile, screenshot };
}

const delay = milliseconds =>
  new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

async function waitForScreenshot(pathname, deadline) {
  while (Date.now() < deadline) {
    try {
      const details = await stat(pathname);
      if (details.isFile() && details.size > 0) {
        return details.size;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
    await delay(100);
  }

  throw new Error("Firefox did not create the content-access screenshot.");
}

async function main() {
  const { firefox, profile, screenshot } = readArguments(
    process.argv.slice(2)
  );
  const [firefoxDetails, profileDetails] = await Promise.all([
    stat(firefox),
    stat(profile),
  ]);
  if (!firefoxDetails.isFile() || !profileDetails.isDirectory()) {
    throw new Error(
      "Firefox must be a file and the profile must be a directory."
    );
  }
  try {
    await stat(screenshot);
    throw new Error(
      "The screenshot target already exists; refusing to overwrite it."
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const fixturePath = fileURLToPath(
    new URL("./fixtures/bootstrap-content-access.html", import.meta.url)
  );
  const fixture = await readFile(fixturePath);
  let reportResult;
  let resolveReport;
  let rejectReport;
  const report = new Promise((resolveValue, rejectValue) => {
    resolveReport = resolveValue;
    rejectReport = rejectValue;
  });

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (requestUrl.pathname === "/report") {
      reportResult = requestUrl.searchParams.get("result");
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("ok");
      resolveReport(reportResult);
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    });
    response.end(fixture);
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The loopback test server did not expose a TCP port.");
  }

  const pageUrl = `http://127.0.0.1:${address.port}/`;
  const child = spawn(
    firefox,
    [
      "--no-remote",
      "--new-instance",
      "--profile",
      profile,
      "--headless",
      "--screenshot",
      screenshot,
      "--window-size",
      "1200,700",
      pageUrl,
    ],
    {
      stdio: "ignore",
      windowsHide: true,
    }
  );
  child.once("error", rejectReport);
  child.once("exit", code => {
    if (code && reportResult === undefined) {
      rejectReport(new Error(`Firefox exited with code ${code}.`));
    }
  });

  const deadline = Date.now() + TIMEOUT_MS;
  let timeoutId;
  const timeout = new Promise((_resolveTimeout, rejectTimeout) => {
    timeoutId = setTimeout(() => {
      rejectTimeout(
        new Error("Timed out waiting for the ordinary-content access result.")
      );
    }, TIMEOUT_MS);
  });

  try {
    await Promise.race([report, timeout]);
    const screenshotBytes = await waitForScreenshot(screenshot, deadline);
    if (reportResult !== "blocked") {
      throw new Error(`Privileged package access result was ${reportResult}.`);
    }

    process.stdout.write(
      `PASS: ordinary HTTP content could not fetch the privileged package; screenshot bytes: ${screenshotBytes}.\n`
    );
  } finally {
    clearTimeout(timeoutId);
    if (reportResult === undefined && child.exitCode === null) {
      child.kill();
    }
    const closing = new Promise(resolveClose => server.close(resolveClose));
    server.closeAllConnections();
    await closing;
  }
}

await main();
