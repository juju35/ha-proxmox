// Writes a capture only when its pixels differ from the file already there: re-encoding the same picture (another
// zlib, another Chromium build) must not show up as a changed screenshot in a pull request.
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// Debian 12's ffmpeg (5.1) cannot read a GIF from a pipe (its demuxer seeks back): decode a temporary copy instead.
const viaFile = (buf, fn) => {
  const dir = mkdtempSync(join(tmpdir(), "pixels-"));
  const file = join(dir, "input");
  try {
    writeFileSync(file, buf);
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Width and height from the file header (PNG IHDR, GIF logical screen), or null for another format. */
export const imageSize = (buf) => {
  if (buf.length >= 24 && buf.toString("latin1", 1, 4) === "PNG") return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.length >= 10 && buf.toString("latin1", 0, 3) === "GIF") return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  return null;
};

/** Decoded RGBA pixels of every frame (PNG: one, GIF: all), with ffmpeg. */
export const ffmpegPixels = (buf) =>
  viaFile(buf, (file) =>
    execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], {
      maxBuffer: 1 << 30,
    }),
  );

/**
 * Saves `data` at `path` unless the file there has the same size and the same decoded pixels.
 * Returns true when the file was written. `pixels` decodes an image buffer (ffmpeg by default).
 */
export const writeIfChanged = (path, data, pixels = ffmpegPixels) => {
  if (existsSync(path)) {
    const old = readFileSync(path);
    if (old.equals(data)) return false;
    const [a, b] = [imageSize(old), imageSize(data)];
    if (a && b && a[0] === b[0] && a[1] === b[1] && pixels(old).equals(pixels(data))) return false;
  }
  writeFileSync(path, data);
  return true;
};
