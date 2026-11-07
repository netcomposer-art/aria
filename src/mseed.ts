/**
 * miniSEED 2 record reader: fixed header, blockette 1000, Steim1 / Steim2 / int16 / int32 / float32 / float64.
 * Ported from Ground Wave (calliope lab/ground-wave/mseed.js), checked against ObsPy (tests/mseed.test.ts).
 * Byte layout from the SEED 2.4 manual; Steim decoding follows the frame / nibble scheme in libmseed.
 */

export interface MseedRecord {
  net: string;
  sta: string;
  loc: string;
  cha: string;
  /** Start time, epoch ms (time correction applied when the header says it isn't yet). */
  startMs: number;
  /** Samples per second. */
  rate: number;
  nsamp: number;
  encoding: number;
  recLen: number;
  samples: Float64Array;
}

function str(dv: DataView, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(dv.getUint8(off + i));
  return s.trim();
}

function headerLE(dv: DataView): boolean {
  // The year (offset 20) reads plausibly in exactly one byte order.
  const be = dv.getUint16(20, false);
  if (be >= 1900 && be <= 2100) return false;
  const le = dv.getUint16(20, true);
  if (le >= 1900 && le <= 2100) return true;
  throw new Error("not a miniSEED record (no plausible year)");
}

function sampleRate(factor: number, mult: number): number {
  let r = 0;
  if (factor > 0) r = factor;
  else if (factor < 0) r = -1 / factor;
  if (mult > 0) r *= mult;
  else if (mult < 0) r /= -mult;
  return r;
}

/** Parse one record starting at the DataView's offset 0. */
export function parseRecord(dv: DataView): MseedRecord {
  if (dv.byteLength < 48) throw new Error("not a miniSEED record (too short)");
  const le = headerLE(dv);
  const year = dv.getUint16(20, le);
  const doy = dv.getUint16(22, le);
  const hour = dv.getUint8(24);
  const min = dv.getUint8(25);
  const sec = dv.getUint8(26);
  const tenthMs = dv.getUint16(28, le);
  const nsamp = dv.getUint16(30, le);
  const rate = sampleRate(dv.getInt16(32, le), dv.getInt16(34, le));
  const activity = dv.getUint8(36);
  const nBlk = dv.getUint8(39);
  const timeCorr = dv.getInt32(40, le);
  const dataOff = dv.getUint16(44, le);
  let blkOff = dv.getUint16(46, le);
  let encoding = 11;
  let wordLE = le;
  let recLen = 512;
  for (let i = 0; i < nBlk && blkOff > 0 && blkOff + 4 <= dv.byteLength; i++) {
    const type = dv.getUint16(blkOff, le);
    const next = dv.getUint16(blkOff + 2, le);
    if (type === 1000 && blkOff + 7 <= dv.byteLength) {
      encoding = dv.getUint8(blkOff + 4);
      wordLE = dv.getUint8(blkOff + 5) === 0;
      recLen = 2 ** dv.getUint8(blkOff + 6);
    }
    blkOff = next;
  }
  let startMs = Date.UTC(year, 0, 1, hour, min, sec) + (doy - 1) * 86400000 + tenthMs / 10;
  // Bit 1 of the activity flags says the time correction is already applied.
  if (!(activity & 0x02) && timeCorr) startMs += timeCorr / 10;
  const bodyLen = Math.max(0, Math.min(recLen, dv.byteLength) - dataOff);
  const body = new DataView(dv.buffer, dv.byteOffset + dataOff, bodyLen);
  const samples = decode(body, encoding, nsamp, wordLE);
  return {
    net: str(dv, 18, 2),
    sta: str(dv, 8, 5),
    loc: str(dv, 13, 2),
    cha: str(dv, 15, 3),
    startMs,
    rate,
    nsamp,
    encoding,
    recLen,
    samples,
  };
}

function decode(dv: DataView, encoding: number, n: number, le: boolean): Float64Array {
  const out = new Float64Array(n);
  switch (encoding) {
    case 1:
      for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, le);
      return out;
    case 3:
      for (let i = 0; i < n; i++) out[i] = dv.getInt32(i * 4, le);
      return out;
    case 4:
      for (let i = 0; i < n; i++) out[i] = dv.getFloat32(i * 4, le);
      return out;
    case 5:
      for (let i = 0; i < n; i++) out[i] = dv.getFloat64(i * 8, le);
      return out;
    case 10:
    case 11:
      return steim(dv, n, le, encoding === 11);
    default:
      throw new Error(`miniSEED encoding ${encoding} is not supported`);
  }
}

function sx(v: number, bits: number): number {
  const shift = 32 - bits;
  return (v << shift) >> shift;
}

function steim(dv: DataView, n: number, le: boolean, two: boolean): Float64Array {
  const out = new Float64Array(n);
  const diffs: number[] = [];
  const frames = Math.floor(dv.byteLength / 64);
  let x0 = 0;
  for (let f = 0; f < frames && diffs.length < n + 1; f++) {
    const base = f * 64;
    const ctrl = dv.getUint32(base, le);
    for (let w = 1; w < 16; w++) {
      const ck = (ctrl >>> (30 - 2 * w)) & 3;
      const word = dv.getInt32(base + w * 4, le);
      if (f === 0 && w === 1) {
        x0 = word;
        continue;
      }
      if (f === 0 && w === 2) continue; // Xn, the reverse integration constant
      if (ck === 0) continue;
      const u = word >>> 0;
      const at = base + w * 4;
      if (ck === 1) {
        // 8-bit differences are stored byte by byte, in order, whatever the word order.
        for (let k = 0; k < 4; k++) diffs.push(dv.getInt8(at + k));
      } else if (!two) {
        if (ck === 2) diffs.push(dv.getInt16(at, le), dv.getInt16(at + 2, le));
        else diffs.push(word);
      } else {
        const dnib = u >>> 30;
        if (ck === 2) {
          if (dnib === 1) diffs.push(sx(u & 0x3fffffff, 30));
          else if (dnib === 2) diffs.push(sx((u >>> 15) & 0x7fff, 15), sx(u & 0x7fff, 15));
          else if (dnib === 3)
            diffs.push(sx((u >>> 20) & 0x3ff, 10), sx((u >>> 10) & 0x3ff, 10), sx(u & 0x3ff, 10));
        } else {
          if (dnib === 0) for (let k = 4; k >= 0; k--) diffs.push(sx((u >>> (k * 6)) & 0x3f, 6));
          else if (dnib === 1)
            for (let k = 5; k >= 0; k--) diffs.push(sx((u >>> (k * 5)) & 0x1f, 5));
          else if (dnib === 2)
            for (let k = 6; k >= 0; k--) diffs.push(sx((u >>> (k * 4)) & 0xf, 4));
        }
      }
    }
  }
  if (n > 0) out[0] = x0;
  for (let i = 1; i < n; i++) out[i] = out[i - 1]! + (diffs[i] ?? 0);
  return out;
}

/** Split a buffer of back-to-back records and parse each. */
export function parseAll(buf: ArrayBuffer): MseedRecord[] {
  const recs: MseedRecord[] = [];
  let off = 0;
  while (off + 64 <= buf.byteLength) {
    const r = parseRecord(new DataView(buf, off));
    recs.push(r);
    off += r.recLen;
  }
  return recs;
}
