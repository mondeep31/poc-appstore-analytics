/**
 * Peek at the first logical line of a bulk-report file (e.g. UTF-16 CSV header) for future parsers.
 * Play CSV reports are typically UTF-16 LE with BOM; fall back to UTF-8.
 */
const MAX_PEEK = 256 * 1024;

export interface PeekFirstLineResult {
  encoding: "utf-16le" | "utf-16be" | "utf-8" | "binary";
  /** First line without trailing CR/LF; empty if none found */
  line: string;
}

export function peekFirstLine(bytes: Buffer): PeekFirstLineResult {
  const slice = bytes.subarray(0, Math.min(bytes.length, MAX_PEEK));

  if (slice.length >= 2) {
    const b0 = slice[0];
    const b1 = slice[1];
    if (b0 === 0xff && b1 === 0xfe) {
      const text = slice.subarray(2).toString("utf16le");
      return { encoding: "utf-16le", line: firstPhysicalLine(text) };
    }
    if (b0 === 0xfe && b1 === 0xff) {
      const swapped = swapUtf16Pairs(slice.subarray(2));
      const text = swapped.toString("utf16le");
      return { encoding: "utf-16be", line: firstPhysicalLine(text) };
    }
  }

  // Heuristic: many NUL bytes → UTF-16 LE without BOM
  let nulCount = 0;
  const checkLen = Math.min(slice.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (slice[i] === 0) nulCount++;
  }
  if (checkLen > 0 && nulCount / checkLen > 0.2) {
    const text = slice.toString("utf16le");
    return { encoding: "utf-16le", line: firstPhysicalLine(text) };
  }

  const utf8 = slice.toString("utf8");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(utf8.slice(0, 200))) {
    return { encoding: "binary", line: "" };
  }

  return { encoding: "utf-8", line: firstPhysicalLine(utf8) };
}

function swapUtf16Pairs(buf: Buffer): Buffer {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i + 1 < buf.length; i += 2) {
    out[i] = buf[i + 1];
    out[i + 1] = buf[i];
  }
  return out;
}

function firstPhysicalLine(text: string): string {
  const idx = text.search(/\r?\n/);
  const line = idx === -1 ? text : text.slice(0, idx);
  return line.replace(/^\uFEFF/, "").trimEnd();
}
