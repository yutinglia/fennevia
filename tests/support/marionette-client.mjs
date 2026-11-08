// SPDX-License-Identifier: MPL-2.0
import net from "node:net";
const STATE_TIMEOUT_MS = 20_000;

export class MarionetteClient {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.frames = [];
    this.waiters = [];
    this.nextCommandId = 0;
    this.closed = false;

    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("close", () => this.onClose());
    socket.on("error", (error) => this.onClose(error));
  }

  static async connect(port) {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    const client = new MarionetteClient(socket);
    const hello = await client.nextFrame(5_000);
    if (
      hello?.applicationType !== "gecko" ||
      !Number.isInteger(hello.marionetteProtocol) ||
      hello.marionetteProtocol < 3
    ) {
      client.close();
      throw new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_PROTOCOL_INVALID");
    }
    return client;
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length > 0) {
      const colonIndex = this.buffer.indexOf(58);
      if (colonIndex === -1) {
        return;
      }
      const lengthText = this.buffer.subarray(0, colonIndex).toString("ascii");
      if (!/^\d+$/u.test(lengthText)) {
        this.onClose(
          new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_FRAME_INVALID"),
        );
        return;
      }
      const bodyLength = Number(lengthText);
      const bodyStart = colonIndex + 1;
      if (this.buffer.length < bodyStart + bodyLength) {
        return;
      }
      const body = this.buffer
        .subarray(bodyStart, bodyStart + bodyLength)
        .toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + bodyLength);
      let frame;
      try {
        frame = JSON.parse(body);
      } catch {
        this.onClose(
          new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_JSON_INVALID"),
        );
        return;
      }
      this.deliver(frame);
    }
  }

  deliver(frame) {
    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timeout);
      waiter.resolve(frame);
    } else {
      this.frames.push(frame);
    }
  }

  onClose(error = new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_CLOSED")) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  }

  nextFrame(timeoutMs) {
    if (this.frames.length > 0) {
      return Promise.resolve(this.frames.shift());
    }
    if (this.closed) {
      return Promise.reject(
        new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_CLOSED"),
      );
    }
    return new Promise((resolve, reject) => {
      const waiter = { reject, resolve, timeout: null };
      waiter.timeout = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index !== -1) {
          this.waiters.splice(index, 1);
        }
        reject(new Error("FENNEVIA_FIREFOX_TEST_MARIONETTE_TIMEOUT"));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  send(frame) {
    const body = Buffer.from(JSON.stringify(frame), "utf8");
    this.socket.write(Buffer.concat([Buffer.from(`${body.length}:`), body]));
  }

  async request(name, parameters = {}, timeoutMs = STATE_TIMEOUT_MS) {
    this.nextCommandId += 1;
    const commandId = this.nextCommandId;
    this.send([0, commandId, name, parameters]);

    while (true) {
      const response = await this.nextFrame(timeoutMs);
      if (
        Array.isArray(response) &&
        response[0] === 1 &&
        response[1] === commandId
      ) {
        if (response[2]) {
          const remoteMessage = String(response[2].message ?? "");
          const projectCode = remoteMessage.match(
            /\bFENNEVIA_[A-Z0-9_]{1,120}\b/u,
          )?.[0];
          if (projectCode) {
            throw new Error(projectCode);
          }
          const remoteCode = String(response[2].error ?? "unknown error")
            .replace(/[^A-Za-z0-9_-]/gu, "_")
            .toUpperCase()
            .slice(0, 80);
          const commandCode = name.replace(/[^A-Za-z0-9]/gu, "_").toUpperCase();
          throw new Error(
            `FENNEVIA_FIREFOX_TEST_REMOTE_${remoteCode}_${commandCode}`,
          );
        }
        return response[3];
      }
      if (Array.isArray(response) && response[0] === 0) {
        this.send([
          1,
          response[1],
          {
            error: "unknown command",
            message: "Unsupported server command",
            stacktrace: "",
          },
          null,
        ]);
      }
    }
  }

  execute(script, timeoutMs = STATE_TIMEOUT_MS) {
    return this.request(
      "WebDriver:ExecuteScript",
      {
        args: [],
        filename: "fennevia-window-lifecycle.mjs",
        line: 1,
        newSandbox: true,
        sandbox: "system",
        script: script.trim(),
      },
      timeoutMs,
    ).then((result) => result?.value);
  }

  close() {
    if (!this.closed) {
      this.closed = true;
      this.socket.destroy();
    }
  }
}
