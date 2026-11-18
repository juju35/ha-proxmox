// The screenshot script rewrites a capture only when its pixels change, not when the same picture is re-encoded.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { imageSize, NOISE, SHADE, samePixels, writeIfChanged } from "../scripts/screenshot-write.mjs";

/** A fake PNG: a real signature and IHDR size, then a "compressed" body that the stub decoder maps to its pixels. */
const png = (w, h, body) => {
  const head = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head);
  head.writeUInt32BE(w, 16);
  head.writeUInt32BE(h, 20);
  return Buffer.concat([head, Buffer.from(body)]);
};
// Two encodings ("a1", "a2") of the same pixels "A"; "b1" are other pixels (one RGBA pixel, colours far apart).
const pixels = (buf) => Buffer.alloc(4, (buf.toString("latin1", 24, 25).toUpperCase().charCodeAt(0) - 65) * 100);

const withDir = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), "sm-shot-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
};

test("a capture with the same pixels is not rewritten, even encoded differently", () => {
  withDir((dir) => {
    const file = join(dir, "card.png");
    writeFileSync(file, png(10, 5, "a1"));
    assert.equal(writeIfChanged(file, png(10, 5, "a2"), pixels), false);
    assert.equal(readFileSync(file).toString("latin1", 24), "a1");
    assert.equal(writeIfChanged(file, png(10, 5, "a1"), pixels), false);
  });
});

test("a capture with other pixels, another size or no previous file is written", () => {
  withDir((dir) => {
    const file = join(dir, "card.png");
    assert.equal(writeIfChanged(file, png(10, 5, "a1"), pixels), true);
    assert.equal(writeIfChanged(file, png(10, 5, "b1"), pixels), true);
    assert.equal(readFileSync(file).toString("latin1", 24), "b1");
    assert.equal(writeIfChanged(file, png(10, 6, "b2"), pixels), true, "same pixel bytes, other size");
  });
});

test("rasterizer noise is the same picture, a real change is not", () => {
  const n = Math.ceil(2 / NOISE); // pixels: two of them may change
  const a = Buffer.alloc(n * 4, 0x80);
  const b = Buffer.from(a);
  for (let i = 0; i < b.length; i += 12) b[i] = 0x80 + SHADE; // a shade off everywhere
  b[1] = 0x00;
  b[4 * 7 + 2] = 0xff;
  assert.equal(samePixels(a, b), true, "shades and two changed pixels");
  b[4 * 99 + 1] = 0x00;
  assert.equal(samePixels(a, b), false, "three changed pixels");
  assert.equal(samePixels(a, Buffer.alloc(n * 4 + 4, 0x80)), false, "another length");
  const tiny = Buffer.alloc(16 * 4, 0x80);
  const other = Buffer.from(tiny);
  other[3] = 0;
  assert.equal(samePixels(tiny, other), false, "a small image allows no changed pixel");
});

test("image sizes are read from PNG and GIF headers", () => {
  assert.deepEqual(imageSize(png(320, 200, "x")), [320, 200]);
  const gif = Buffer.from("GIF89a\x40\x01\xc8\x00", "latin1");
  assert.deepEqual(imageSize(gif), [320, 200]);
  assert.equal(imageSize(Buffer.from("nope")), null);
});

let ffmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  ffmpeg = false;
}

test("with ffmpeg: two PNG encodings of one picture are the same, another picture is not", { skip: !ffmpeg && "no ffmpeg" }, () => {
  withDir((dir) => {
    const make = (name, color, level) => {
      const out = join(dir, name);
      execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:s=16x8:d=0.04`, "-frames:v", "1", "-compression_level", String(level), out]);
      return out;
    };
    const a = make("a.png", "0x18bcf2", 0);
    const a2 = readFileSync(make("a2.png", "0x18bcf2", 9));
    assert.notDeepEqual(readFileSync(a), a2, "the two encodings differ byte for byte");
    const size = statSync(a).size;
    assert.equal(writeIfChanged(a, a2), false);
    assert.equal(statSync(a).size, size);
    assert.equal(writeIfChanged(a, readFileSync(make("b.png", "0xffa600", 9))), true);
  });
});
