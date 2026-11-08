// SPDX-License-Identifier: MPL-2.0
// Original geometric F mark. ICO pixels are reproducible from this source.
import { mkdir, writeFile } from "node:fs/promises";
const side = 32;
const pixels = side * side * 4;
const mask = side * 4;
const buffer = Buffer.alloc(22 + 40 + pixels + mask);
buffer.writeUInt16LE(1, 2);
buffer.writeUInt16LE(1, 4);
buffer[6] = side;
buffer[7] = side;
buffer.writeUInt16LE(1, 10);
buffer.writeUInt16LE(32, 12);
buffer.writeUInt32LE(40 + pixels + mask, 14);
buffer.writeUInt32LE(22, 18);
buffer.writeUInt32LE(40, 22);
buffer.writeInt32LE(side, 26);
buffer.writeInt32LE(side * 2, 30);
buffer.writeUInt16LE(1, 34);
buffer.writeUInt16LE(32, 36);
buffer.writeUInt32LE(pixels, 42);
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const foreground =
      (x >= 8 && x < 13 && y >= 7 && y < 26) ||
      (x >= 13 && x < 25 && y >= 7 && y < 12) ||
      (x >= 13 && x < 22 && y >= 15 && y < 20);
    const rgb = foreground ? [248, 247, 242] : [35, 78, 63];
    const offset = 62 + ((side - y - 1) * side + x) * 4;
    buffer.set([rgb[2], rgb[1], rgb[0], 255], offset);
  }
}
const directory = new URL("../src-tauri/icons/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("icon.ico", directory), buffer);
