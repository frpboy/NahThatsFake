import crypto from 'crypto';
import exifr from 'exifr';
import { escapeMarkdown } from '../utils/markdown';

/**
 * Provenance layer for image checks: C2PA Content Credentials + embedded
 * metadata signals (IPTC DigitalSourceType, XMP/EXIF tool fields).
 *
 * VERIFICATION LEVEL — read this before trusting the word "valid":
 * this module performs PRESENCE DETECTION + STRUCTURAL PARSE of a C2PA
 * manifest store (JUMBF), plus an integrity check of the claim's
 * assertion hashes (each sha256 assertion hash in the claim is compared
 * against the assertion box as stored). It does NOT cryptographically
 * verify the COSE signature or the signer's certificate chain — the
 * maintained library for that (c2pa-node) is a native Rust binding
 * fetched by a postinstall download and is impractical in this bot's
 * node:22-alpine (musl) Docker image, so it was deliberately not used.
 * User-facing wording therefore says a manifest is "found" and whether
 * its integrity hashes match; it never says the signature was verified.
 *
 * SynthID is NOT checked here and cannot be: Google's SynthID watermark
 * detection has no public API (the free SynthID Detector is a manual
 * web portal whose terms forbid automated checks, and Google Cloud's
 * Content Detection API is a trusted-partner preview). The formatted
 * section says exactly that and points the user at synthid.com.
 *
 * Everything in this module settles independently: analyzeProvenance
 * never throws, so a provenance failure can never fail an image check.
 */

export type C2paStatus = 'valid' | 'invalid' | 'absent' | 'unsupported' | 'error';

export interface C2paDetails {
  /** claim_generator from the C2PA claim (the tool that made the file). */
  claimGenerator?: string;
  /** Signer name read from the signing certificate (issuer O/CN). NOT a
   *  verified identity — the certificate chain is not validated. */
  signer?: string;
  /** digitalSourceType from the c2pa.actions assertion (URI or code). */
  digitalSourceType?: string;
  /** True when every sha256 assertion hash in the claim matches the
   *  assertion box as stored; false when one mismatches or a referenced
   *  assertion is missing; undefined when the claim lists no assertions. */
  assertionsVerified?: boolean;
  manifestCount?: number;
}

export interface ProvenanceResult {
  c2pa: C2paStatus;
  c2paDetails?: C2paDetails;
  /** IPTC DigitalSourceType code from embedded metadata, when present. */
  iptcSourceType?: string;
  /** Plain-language metadata hints (AI tool names found in metadata). */
  aiMetadataHints: string[];
  /** How Telegram delivered the image: photos are recompressed by
   *  Telegram (credentials/metadata stripped); documents arrive intact. */
  checkedAs: 'photo' | 'document';
}

/** The fixed, honest SynthID line used in every image result. */
export const SYNTHID_LINE =
  "🔏 *SynthID:* Google's SynthID watermark can't be checked inside this bot (Google provides no API for it). You can verify an image for SynthID free at synthid.com.";

// ---------------------------------------------------------------------------
// Minimal CBOR decoder (RFC 8949). Only what C2PA structures need: ints,
// byte/text strings, arrays, maps, booleans/null, floats, tags (skipped).
// Maps whose keys are all text decode to plain objects; maps with any
// non-text key (e.g. COSE headers, keyed by integer) decode to a Map.
// ---------------------------------------------------------------------------

type CborValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | Buffer
  | CborValue[]
  | Map<unknown, CborValue>
  | { [key: string]: CborValue };

function cborDecode(bytes: Uint8Array, offset = 0): { value: CborValue; next: number } {
  let pos = offset;
  const readByte = (): number => {
    if (pos >= bytes.length) throw new Error('CBOR: unexpected end of input');
    return bytes[pos++];
  };
  const readBytes = (n: number): Uint8Array => {
    if (pos + n > bytes.length) throw new Error('CBOR: unexpected end of input');
    const out = bytes.subarray(pos, pos + n);
    pos += n;
    return out;
  };
  const readArgument = (ai: number): number => {
    if (ai < 24) return ai;
    if (ai === 24) return readByte();
    if (ai === 25) {
      const b = readBytes(2);
      return (b[0] << 8) | b[1];
    }
    if (ai === 26) {
      const b = readBytes(4);
      return b[0] * 2 ** 24 + b[1] * 2 ** 16 + b[2] * 2 ** 8 + b[3];
    }
    if (ai === 27) {
      const b = readBytes(8);
      const view = new DataView(b.buffer, b.byteOffset, 8);
      const num = view.getFloat64(0);
      if (!Number.isInteger(num) || Math.abs(num) > Number.MAX_SAFE_INTEGER) {
        // Large uint64s lose precision here; C2PA claims/signatures do
        // not rely on exact big-int values for the fields we read.
        return num;
      }
      return num;
    }
    throw new Error(`CBOR: reserved additional information ${ai}`);
  };

  const decodeItem = (): CborValue => {
    const initial = readByte();
    const major = initial >> 5;
    const ai = initial & 0x1f;

    switch (major) {
      case 0:
        return readArgument(ai);
      case 1:
        return -1 - readArgument(ai);
      case 2: {
        if (ai === 31) {
          const chunks: Uint8Array[] = [];
          for (;;) {
            if (pos >= bytes.length) throw new Error('CBOR: unterminated byte string');
            if (bytes[pos] === 0xff) { pos++; break; }
            const part = decodeItem();
            if (!Buffer.isBuffer(part)) throw new Error('CBOR: bad byte string chunk');
            chunks.push(part);
          }
          return Buffer.concat(chunks);
        }
        return Buffer.from(readBytes(readArgument(ai)));
      }
      case 3: {
        if (ai === 31) {
          let out = '';
          for (;;) {
            if (pos >= bytes.length) throw new Error('CBOR: unterminated text string');
            if (bytes[pos] === 0xff) { pos++; break; }
            const part = decodeItem();
            if (typeof part !== 'string') throw new Error('CBOR: bad text string chunk');
            out += part;
          }
          return out;
        }
        return Buffer.from(readBytes(readArgument(ai))).toString('utf8');
      }
      case 4: {
        const items: CborValue[] = [];
        if (ai === 31) {
          for (;;) {
            if (pos >= bytes.length) throw new Error('CBOR: unterminated array');
            if (bytes[pos] === 0xff) { pos++; break; }
            items.push(decodeItem());
          }
          return items;
        }
        const count = readArgument(ai);
        for (let i = 0; i < count; i++) items.push(decodeItem());
        return items;
      }
      case 5: {
        const entries: Array<[unknown, CborValue]> = [];
        const readPair = (): void => {
          const key = decodeItem();
          const value = decodeItem();
          entries.push([key, value]);
        };
        if (ai === 31) {
          for (;;) {
            if (pos >= bytes.length) throw new Error('CBOR: unterminated map');
            if (bytes[pos] === 0xff) { pos++; break; }
            readPair();
          }
        } else {
          const count = readArgument(ai);
          for (let i = 0; i < count; i++) readPair();
        }
        if (entries.every(([key]) => typeof key === 'string')) {
          const obj: { [key: string]: CborValue } = {};
          for (const [key, value] of entries) obj[key as string] = value;
          return obj;
        }
        return new Map(entries);
      }
      case 6:
        readArgument(ai); // tag number: skipped, decode the tagged value
        return decodeItem();
      case 7: {
        if (ai === 25) {
          const b = readBytes(2);
          return halfToFloat((b[0] << 8) | b[1]);
        }
        if (ai === 26) {
          const b = readBytes(4);
          return new DataView(b.buffer, b.byteOffset, 4).getFloat32(0);
        }
        if (ai === 27) {
          const b = readBytes(8);
          return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0);
        }
        if (ai === 31) throw new Error('CBOR: unexpected break');
        switch (ai) {
          case 20: return false;
          case 21: return true;
          case 22: return null;
          case 23: return undefined;
          default: return readArgument(ai); // simple value: return its code
        }
      }
      default:
        throw new Error(`CBOR: bad major type ${major}`);
    }
  };

  const value = decodeItem();
  return { value, next: pos };
}

function halfToFloat(half: number): number {
  const sign = (half >> 15) & 1;
  const exp = (half >> 10) & 0x1f;
  const frac = half & 0x3ff;
  if (exp === 0) return (sign ? -1 : 1) * frac * 2 ** -24;
  if (exp === 31) return frac === 0 ? (sign ? -Infinity : Infinity) : NaN;
  return (sign ? -1 : 1) * (1 + frac / 1024) * 2 ** (exp - 15);
}

function cborMapGet(map: CborValue, key: string | number): CborValue {
  if (map instanceof Map) return map.get(key);
  if (map && typeof map === 'object' && !Buffer.isBuffer(map) && !Array.isArray(map)) {
    return (map as { [key: string]: CborValue })[String(key)];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Container scanning: locate the C2PA manifest store bytes in the file.
// JPEG: JUMBF in APP11 segments (CI 'JP'). PNG: 'caBX' chunk.
// WebP: 'C2PA' RIFF chunk.
// ---------------------------------------------------------------------------

type ImageFormat = 'jpeg' | 'png' | 'webp' | 'unknown';

function detectFormat(buffer: Buffer): ImageFormat {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) return 'webp';
  return 'unknown';
}

interface StoreExtraction {
  store: Buffer | null;
  truncated: boolean;
}

function extractJpegStore(buffer: Buffer): StoreExtraction {
  const fragments: Array<{ en: number; data: Buffer }> = [];
  let declaredTotal = 0;
  let truncated = false;
  let offset = 2; // skip SOI

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    let marker = buffer[offset + 1];
    let markerStart = offset;
    // Skip padding 0xFF bytes before the marker code.
    while (marker === 0xff && markerStart + 2 < buffer.length) {
      markerStart++;
      marker = buffer[markerStart + 1];
    }
    if (marker === 0xd9) break; // EOI
    if (marker === 0xda) break; // SOS: compressed data follows, stop
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset = markerStart + 2; // standalone markers carry no length
      continue;
    }
    if (markerStart + 4 > buffer.length) { truncated = true; break; }
    const segLen = buffer.readUInt16BE(markerStart + 2);
    if (segLen < 2) break;
    if (markerStart + 2 + segLen > buffer.length) {
      // A declared segment runs past the end of the file.
      if (marker === 0xeb) truncated = true;
      break;
    }
    if (marker === 0xeb) {
      // APP11: Lp(2) CI(2) En(2) Z(4) then a JUMBF fragment.
      const dataStart = markerStart + 4;
      const ci = buffer.toString('latin1', dataStart, dataStart + 2);
      if (ci === 'JP' && segLen >= 10) {
        const en = buffer.readUInt16BE(dataStart + 2);
        const z = buffer.readUInt32BE(dataStart + 4);
        if (declaredTotal === 0) declaredTotal = z;
        fragments.push({ en, data: buffer.subarray(dataStart + 8, markerStart + 2 + segLen) });
      }
    }
    offset = markerStart + 2 + segLen;
  }

  if (fragments.length === 0) return { store: null, truncated };
  fragments.sort((a, b) => a.en - b.en);
  let store = Buffer.concat(fragments.map(f => f.data));
  if (declaredTotal > 0) {
    if (store.length < declaredTotal) return { store: null, truncated: true };
    if (store.length > declaredTotal) store = store.subarray(0, declaredTotal);
  }
  return { store, truncated };
}

function extractPngStore(buffer: Buffer): StoreExtraction {
  const parts: Buffer[] = [];
  let truncated = false;
  let offset = 8; // skip signature

  while (offset + 8 <= buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    if (offset + 12 + len > buffer.length) {
      if (type === 'caBX') truncated = true;
      break;
    }
    if (type === 'caBX') parts.push(buffer.subarray(offset + 8, offset + 8 + len));
    if (type === 'IEND') break;
    offset += 12 + len;
  }

  if (parts.length === 0) return { store: null, truncated };
  return { store: Buffer.concat(parts), truncated };
}

function extractWebpStore(buffer: Buffer): StoreExtraction {
  const parts: Buffer[] = [];
  let truncated = false;
  let offset = 12; // skip RIFF header + WEBP tag

  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + size > buffer.length) {
      if (fourcc === 'C2PA') truncated = true;
      break;
    }
    if (fourcc === 'C2PA') parts.push(buffer.subarray(offset + 8, offset + 8 + size));
    offset += 8 + size + (size % 2); // chunks are padded to even sizes
  }

  if (parts.length === 0) return { store: null, truncated };
  return { store: Buffer.concat(parts), truncated };
}

function extractStore(buffer: Buffer, format: ImageFormat): StoreExtraction {
  switch (format) {
    case 'jpeg': return extractJpegStore(buffer);
    case 'png': return extractPngStore(buffer);
    case 'webp': return extractWebpStore(buffer);
    default: return { store: null, truncated: false };
  }
}

// ---------------------------------------------------------------------------
// JUMBF walking. A box is LBox(4) TBox(4) payload; 'jumb' superboxes start
// with a 'jumd' description box (uuid(16) toggles(1) label?) followed by
// child boxes. We locate, inside one manifest superbox: the claim box
// ('c2cl', CBOR), the signature box ('c2cs', COSE_Sign1 CBOR), and every
// labelled assertion superbox (byte range + 'cbor'/'json' payload).
// ---------------------------------------------------------------------------

interface JumbfBox {
  type: string;
  start: number;
  end: number;
  contentStart: number;
  label?: string;
  children: JumbfBox[];
}

function parseBox(buffer: Buffer, start: number, boundEnd: number): JumbfBox | null {
  if (start + 8 > boundEnd) return null;
  let length = buffer.readUInt32BE(start);
  let headerSize = 8;
  if (length === 1) {
    if (start + 16 > boundEnd) return null;
    const big = buffer.readBigUInt64BE(start + 8);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    length = Number(big);
    headerSize = 16;
  } else if (length === 0) {
    length = boundEnd - start;
  }
  if (length < headerSize || start + length > boundEnd) return null;

  const box: JumbfBox = {
    type: buffer.toString('latin1', start + 4, start + 8),
    start,
    end: start + length,
    contentStart: start + headerSize,
    children: []
  };

  if (box.type === 'jumb') {
    let childStart = box.contentStart;
    while (childStart < box.end) {
      const child = parseBox(buffer, childStart, box.end);
      if (!child) break;
      box.children.push(child);
      childStart = child.end;
    }
    const jumd = box.children.find(c => c.type === 'jumd');
    if (jumd) box.label = parseJumdLabel(buffer, jumd);
  }
  return box;
}

function parseJumdLabel(buffer: Buffer, jumd: JumbfBox): string | undefined {
  // jumd content: uuid(16) toggles(1) label(null-terminated, if toggles&1)
  const start = jumd.contentStart;
  if (start + 17 > jumd.end) return undefined;
  const toggles = buffer[start + 16];
  if ((toggles & 1) === 0) return undefined;
  const labelStart = start + 17;
  let labelEnd = labelStart;
  while (labelEnd < jumd.end && buffer[labelEnd] !== 0) labelEnd++;
  return buffer.toString('utf8', labelStart, labelEnd);
}

function findBoxes(box: JumbfBox, type: string, out: JumbfBox[] = []): JumbfBox[] {
  if (box.type === type) out.push(box);
  for (const child of box.children) findBoxes(child, type, out);
  return out;
}

// ---------------------------------------------------------------------------
// Signer name from the COSE signature's x5chain certificate. Minimal DER
// walk to the issuer/subject names; extracts O, else CN, else OU. This is
// a display string only — the chain is NOT validated (see header note).
// ---------------------------------------------------------------------------

interface DerTlv { tag: number; contentStart: number; end: number }

function readDerTlv(buf: Buffer, offset: number): DerTlv | null {
  if (offset + 2 > buf.length) return null;
  const tag = buf[offset];
  if ((tag & 0x1f) === 0x1f) return null; // multi-byte tags: not expected in names
  let pos = offset + 1;
  const firstLen = buf[pos++];
  let length: number;
  if (firstLen < 0x80) {
    length = firstLen;
  } else {
    const numBytes = firstLen & 0x7f;
    if (numBytes === 0 || numBytes > 4 || pos + numBytes > buf.length) return null;
    length = 0;
    for (let i = 0; i < numBytes; i++) length = length * 256 + buf[pos++];
  }
  if (pos + length > buf.length) return null;
  return { tag, contentStart: pos, end: pos + length };
}

function derChildren(buf: Buffer, tlv: DerTlv): DerTlv[] {
  const children: DerTlv[] = [];
  let pos = tlv.contentStart;
  while (pos < tlv.end) {
    const child = readDerTlv(buf, pos);
    if (!child || child.end > tlv.end) break;
    children.push(child);
    pos = child.end;
  }
  return children;
}

function decodeOid(buf: Buffer, tlv: DerTlv): string {
  const bytes = buf.subarray(tlv.contentStart, tlv.end);
  if (bytes.length === 0) return '';
  const parts: number[] = [];
  const first = bytes[0];
  parts.push(Math.min(2, Math.floor(first / 40)), first >= 80 ? first - 80 : first % 40);
  let value = 0;
  for (let i = 1; i < bytes.length; i++) {
    value = value * 128 + (bytes[i] & 0x7f);
    if ((bytes[i] & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
}

function parseDerName(buf: Buffer, nameTlv: DerTlv): { O?: string; CN?: string; OU?: string } {
  const out: { O?: string; CN?: string; OU?: string } = {};
  for (const set of derChildren(buf, nameTlv)) {
    if (set.tag !== 0x31) continue;
    for (const pair of derChildren(buf, set)) {
      if (pair.tag !== 0x30) continue;
      const parts = derChildren(buf, pair);
      if (parts.length < 2 || parts[0].tag !== 0x06) continue;
      const oid = decodeOid(buf, parts[0]);
      const valueTlv = parts[1];
      let value: string;
      if (valueTlv.tag === 0x0c) value = buf.toString('utf8', valueTlv.contentStart, valueTlv.end);
      else value = buf.toString('latin1', valueTlv.contentStart, valueTlv.end);
      if (oid === '2.5.4.10' && !out.O) out.O = value;
      if (oid === '2.5.4.3' && !out.CN) out.CN = value;
      if (oid === '2.5.4.11' && !out.OU) out.OU = value;
    }
  }
  return out;
}

function signerNameFromCert(cert: Buffer): string | undefined {
  try {
    const outer = readDerTlv(cert, 0);
    if (!outer || outer.tag !== 0x30) return undefined;
    const tbs = derChildren(cert, outer)[0];
    if (!tbs || tbs.tag !== 0x30) return undefined;
    const fields = derChildren(cert, tbs);
    let idx = 0;
    if (fields[idx]?.tag === 0xa0) idx++; // version
    idx++; // serial number
    idx++; // signature algorithm
    const issuer = fields[idx];
    if (!issuer || issuer.tag !== 0x30) return undefined;
    const issuerName = parseDerName(cert, issuer);
    const fromIssuer = issuerName.O || issuerName.CN || issuerName.OU;
    if (fromIssuer) return fromIssuer;
    const subject = fields[idx + 2]; // skip validity
    if (subject && subject.tag === 0x30) {
      const subjectName = parseDerName(cert, subject);
      return subjectName.O || subjectName.CN || subjectName.OU;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function signerFromCose(signaturePayload: Buffer): string | undefined {
  try {
    const { value } = cborDecode(signaturePayload);
    if (!Array.isArray(value) || value.length < 2) return undefined;
    const protectedBytes = value[0];
    const unprotected = value[1];
    let chain: CborValue;
    if (unprotected !== undefined) chain = cborMapGet(unprotected, 33);
    if (chain === undefined && Buffer.isBuffer(protectedBytes) && protectedBytes.length > 0) {
      chain = cborMapGet(cborDecode(protectedBytes).value, 33);
    }
    const certs: Buffer[] = [];
    if (Buffer.isBuffer(chain)) certs.push(chain);
    if (Array.isArray(chain)) {
      for (const item of chain) if (Buffer.isBuffer(item)) certs.push(item);
    }
    if (certs.length === 0) return undefined;
    return signerNameFromCert(certs[0]);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Manifest parse
// ---------------------------------------------------------------------------

interface ManifestParse {
  details: C2paDetails;
  assertionsVerified?: boolean;
}

function parseManifest(store: Buffer, manifest: JumbfBox): ManifestParse {
  const claimBox = findBoxes(manifest, 'c2cl')[0];
  if (!claimBox) throw new Error('manifest has no claim box');
  const claim = cborDecode(store.subarray(claimBox.contentStart, claimBox.end)).value;
  if (!claim || typeof claim !== 'object' || Buffer.isBuffer(claim) || Array.isArray(claim) || claim instanceof Map) {
    throw new Error('claim is not a CBOR map');
  }
  const claimObj = claim as { [key: string]: CborValue };

  const details: C2paDetails = {};
  if (typeof claimObj.claim_generator === 'string') {
    details.claimGenerator = claimObj.claim_generator;
  } else if (Array.isArray(claimObj.claim_generator_info) && claimObj.claim_generator_info.length > 0) {
    const name = cborMapGet(claimObj.claim_generator_info[0], 'name');
    if (typeof name === 'string') details.claimGenerator = name;
  }

  // Assertion boxes within this manifest, by description label.
  const assertionBoxes = new Map<string, JumbfBox>();
  const collectAssertions = (box: JumbfBox): void => {
    if (box.type === 'jumb' && box.label && box !== manifest) {
      assertionBoxes.set(box.label, box);
    }
    for (const child of box.children) collectAssertions(child);
  };
  collectAssertions(manifest);

  // digitalSourceType from the actions assertion.
  for (const [label, box] of assertionBoxes) {
    if (!label.startsWith('c2pa.actions')) continue;
    const payloadBox = box.children.find(c => c.type === 'cbor' || c.type === 'json');
    if (!payloadBox) continue;
    try {
      const parsed = payloadBox.type === 'cbor'
        ? cborDecode(store.subarray(payloadBox.contentStart, payloadBox.end)).value
        : JSON.parse(store.toString('utf8', payloadBox.contentStart, payloadBox.end));
      const actions = cborMapGet(parsed as CborValue, 'actions');
      if (Array.isArray(actions)) {
        for (const action of actions) {
          const dst = cborMapGet(action, 'digitalSourceType');
          if (typeof dst === 'string' && dst) {
            details.digitalSourceType = dst;
            break;
          }
        }
      }
    } catch {
      // A broken actions assertion does not break the manifest parse.
    }
    if (details.digitalSourceType) break;
  }

  // Signer display name from the COSE signature's certificate.
  const signatureBox = findBoxes(manifest, 'c2cs')[0];
  if (signatureBox) {
    details.signer = signerFromCose(store.subarray(signatureBox.contentStart, signatureBox.end));
  }

  // Assertion integrity: every sha256 hash in the claim must match the
  // assertion box as stored. (Integrity only — see the header note: the
  // COSE signature itself is NOT cryptographically verified.)
  let assertionsVerified: boolean | undefined;
  const claimAssertions = claimObj.assertions;
  if (Array.isArray(claimAssertions) && claimAssertions.length > 0) {
    assertionsVerified = true;
    for (const entry of claimAssertions) {
      const url = cborMapGet(entry, 'url');
      const hash = cborMapGet(entry, 'hash');
      const alg = cborMapGet(entry, 'alg');
      if (typeof alg === 'string' && alg !== 'sha256') continue;
      if (typeof url !== 'string' || !Buffer.isBuffer(hash)) {
        assertionsVerified = false;
        continue;
      }
      const label = decodeURIComponent(url.split('/').pop() || '');
      const box = assertionBoxes.get(label);
      if (!box) {
        assertionsVerified = false;
        continue;
      }
      const actual = crypto.createHash('sha256').update(store.subarray(box.start, box.end)).digest();
      if (!actual.equals(hash)) assertionsVerified = false;
    }
  }
  details.assertionsVerified = assertionsVerified;

  return { details, assertionsVerified };
}

function parseStore(store: Buffer): { status: 'valid' | 'invalid'; details?: C2paDetails } {
  const root = parseBox(store, 0, store.length);
  if (!root || root.type !== 'jumb') return { status: 'invalid' };

  // Manifests are the store's child superboxes that contain a claim;
  // fall back to the root itself for a bare-manifest embedding.
  const candidates = root.children.filter(
    c => c.type === 'jumb' && findBoxes(c, 'c2cl').length > 0
  );
  const manifests = candidates.length > 0
    ? candidates
    : (findBoxes(root, 'c2cl').length > 0 ? [root] : []);
  if (manifests.length === 0) return { status: 'invalid' };

  try {
    const { details, assertionsVerified } = parseManifest(store, manifests[0]);
    details.manifestCount = manifests.length;
    return { status: assertionsVerified === false ? 'invalid' : 'valid', details };
  } catch {
    return { status: 'invalid' };
  }
}

// ---------------------------------------------------------------------------
// Metadata signals (EXIF / XMP / IPTC via exifr, plus a conservative raw
// scan: XMP packets are plain XML in JPEG and WebP, so the IPTC source
// type URI and well-known AI tool names survive even where a parser
// segment was not requested).
// ---------------------------------------------------------------------------

const AI_SOURCE_TYPES = new Set([
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia'
]);

const AI_TOOL_NAMES = [
  'Midjourney',
  'Stable Diffusion',
  'DALL·E',
  'DALL-E',
  'Adobe Firefly',
  'ChatGPT',
  'NovelAI',
  'Ideogram',
  'Imagen',
  'Gemini'
];

function sourceTypeCode(value: string): string {
  const trimmed = value.trim();
  const slash = trimmed.lastIndexOf('/');
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

async function readMetadata(buffer: Buffer): Promise<{ iptcSourceType?: string; hints: string[] }> {
  const hints: string[] = [];
  let iptcSourceType: string | undefined;

  let fields: Record<string, unknown> = {};
  try {
    const parsed = await exifr.parse(buffer, { exif: true, xmp: true, iptc: true });
    if (parsed && typeof parsed === 'object') fields = parsed as Record<string, unknown>;
  } catch {
    // Unparseable metadata is normal for most images; the raw scan and
    // the C2PA result still stand on their own.
  }

  const dst = fields.DigitalSourceType;
  if (typeof dst === 'string' && dst) iptcSourceType = sourceTypeCode(dst);

  const raw = buffer.toString('latin1');
  if (!iptcSourceType) {
    // Check the composite form first: it contains the plain form as a
    // substring.
    if (raw.includes('compositeWithTrainedAlgorithmicMedia')) {
      iptcSourceType = 'compositeWithTrainedAlgorithmicMedia';
    } else if (raw.includes('trainedAlgorithmicMedia')) {
      iptcSourceType = 'trainedAlgorithmicMedia';
    } else if (raw.includes('algorithmicMedia')) {
      iptcSourceType = 'algorithmicMedia';
    }
  }

  const toolFields = [fields.Software, fields.CreatorTool, fields.ProcessingSoftware]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');
  const seen = new Set<string>();
  for (const tool of AI_TOOL_NAMES) {
    if (seen.has(tool)) continue;
    if (toolFields.toLowerCase().includes(tool.toLowerCase()) || raw.includes(tool)) {
      seen.add(tool);
      hints.push(`File metadata mentions ${tool}, an AI image tool`);
    }
  }

  return { iptcSourceType, hints };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeProvenance(
  imageBuffer: Buffer,
  checkedAs: 'photo' | 'document'
): Promise<ProvenanceResult> {
  const base: ProvenanceResult = { c2pa: 'error', aiMetadataHints: [], checkedAs };
  try {
    const format = detectFormat(imageBuffer);
    let c2pa: C2paStatus;
    let c2paDetails: C2paDetails | undefined;

    if (format === 'unknown') {
      c2pa = 'unsupported';
    } else {
      const { store, truncated } = extractStore(imageBuffer, format);
      if (truncated) {
        c2pa = 'error';
      } else if (!store) {
        c2pa = 'absent';
      } else {
        const parsed = parseStore(store);
        c2pa = parsed.status;
        c2paDetails = parsed.details;
      }
    }

    const metadata = await readMetadata(imageBuffer).catch(() => ({
      iptcSourceType: undefined,
      hints: [] as string[]
    }));

    return {
      c2pa,
      c2paDetails,
      iptcSourceType: metadata.iptcSourceType,
      aiMetadataHints: metadata.hints,
      checkedAs
    };
  } catch (error) {
    console.error('Provenance analysis failed:', error instanceof Error ? error.message : 'unknown-error');
    return base;
  }
}

function describeSourceType(code: string): string {
  switch (code) {
    case 'trainedAlgorithmicMedia':
      return 'generated by AI (trainedAlgorithmicMedia)';
    case 'compositeWithTrainedAlgorithmicMedia':
      return 'AI-generated content combined with other media (compositeWithTrainedAlgorithmicMedia)';
    case 'algorithmicMedia':
      return 'generated by an algorithm (algorithmicMedia)';
    default:
      return escapeMarkdown(code);
  }
}

/**
 * Format the provenance section of an image result. It is deliberately a
 * separate section from the Sightengine verdict: provenance evidence is
 * about where the file came from, not a second AI verdict, and it must
 * never be read as one.
 */
export function formatProvenanceSection(result: ProvenanceResult): string {
  const lines: string[] = [];
  lines.push('🧬 *Provenance* — content credentials & metadata (separate from the AI-detection verdict above)');
  lines.push('');

  const details = result.c2paDetails;
  switch (result.c2pa) {
    case 'valid': {
      let line = '🪪 *Content Credentials (C2PA): found*';
      const createdWith = details?.claimGenerator;
      const signer = details?.signer;
      if (createdWith) line += ` — created with ${escapeMarkdown(createdWith)}`;
      if (signer) line += `, signed by ${escapeMarkdown(signer)}`;
      line += details?.assertionsVerified
        ? ". The manifest's integrity hashes match, but this bot does not cryptographically verify the signature."
        : ', readable as stored. This bot does not cryptographically verify the signature.';
      lines.push(line);
      break;
    }
    case 'invalid':
      lines.push('🪪 *Content Credentials (C2PA): found but not trustworthy* — the manifest could not be read or failed integrity checks, so it proves nothing about this image.');
      break;
    case 'absent':
      lines.push('🪪 *Content Credentials (C2PA): none found* in this file.');
      break;
    case 'unsupported':
      lines.push('🪪 *Content Credentials (C2PA): not checked* — this file format is not supported for credential checks.');
      break;
    case 'error':
      lines.push('🪪 *Content Credentials (C2PA): check failed* — the provenance check could not be completed for this file.');
      break;
  }

  if (details?.digitalSourceType) {
    const code = sourceTypeCode(details.digitalSourceType);
    if (AI_SOURCE_TYPES.has(code)) {
      lines.push(`🤖 The credentials declare this image was *${describeSourceType(code)}*.`);
    }
  }

  if (result.iptcSourceType) {
    lines.push(`📇 *Declared source (IPTC metadata):* ${describeSourceType(result.iptcSourceType)}`);
  }

  for (const hint of result.aiMetadataHints) {
    lines.push(`🔎 ${escapeMarkdown(hint)}.`);
  }

  if (result.checkedAs === 'photo' && result.c2pa === 'absent') {
    lines.push('ℹ️ You sent this as a Telegram photo, which strips credentials and metadata. To preserve them, send the image as a *file/document* instead.');
  }

  lines.push(SYNTHID_LINE);
  return lines.join('\n');
}
