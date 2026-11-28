import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  analyzeProvenance,
  formatProvenanceSection,
  SYNTHID_LINE
} from '../src/services/provenance';

// Behavioural tests for the provenance layer. The fixtures are built
// in-test: a minimal CBOR encoder, a minimal DER certificate builder
// and a JUMBF assembler construct a small but structurally real C2PA
// manifest store (claim with a sha256 assertion hash, c2pa.actions
// assertion with an IPTC digital source type, COSE signature box with
// an x5chain certificate). No network, no downloaded samples, no
// Sightengine credentials needed.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');

// --- Minimal CBOR encoder (subset used by the fixtures) ---------------------

function cborHead(major: number, arg: number): Buffer {
  const mt = major << 5;
  if (arg < 24) return Buffer.from([mt | arg]);
  if (arg < 256) return Buffer.from([mt | 24, arg]);
  if (arg < 65536) {
    const b = Buffer.alloc(3);
    b[0] = mt | 25;
    b.writeUInt16BE(arg, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = mt | 26;
  b.writeUInt32BE(arg, 1);
  return b;
}

function cborEncode(value: unknown): Buffer {
  const chunks: Buffer[] = [];
  const encode = (v: unknown): void => {
    if (v === null) { chunks.push(Buffer.from([0xf6])); return; }
    if (v === true) { chunks.push(Buffer.from([0xf5])); return; }
    if (v === false) { chunks.push(Buffer.from([0xf4])); return; }
    if (typeof v === 'number') {
      chunks.push(v >= 0 ? cborHead(0, v) : cborHead(1, -1 - v));
      return;
    }
    if (typeof v === 'string') {
      const b = Buffer.from(v, 'utf8');
      chunks.push(cborHead(3, b.length), b);
      return;
    }
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
      const b = Buffer.from(v as Uint8Array);
      chunks.push(cborHead(2, b.length), b);
      return;
    }
    if (Array.isArray(v)) {
      chunks.push(cborHead(4, v.length));
      for (const item of v) encode(item);
      return;
    }
    if (v instanceof Map) {
      chunks.push(cborHead(5, v.size));
      for (const [k, val] of v) { encode(k); encode(val); }
      return;
    }
    if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      chunks.push(cborHead(5, entries.length));
      for (const [k, val] of entries) { encode(k); encode(val); }
      return;
    }
    throw new Error(`fixture encoder: unsupported value ${String(v)}`);
  };
  encode(value);
  return Buffer.concat(chunks);
}

// --- Minimal DER builder (just enough certificate for the signer name) ------

function derTlv(tag: number, content: Buffer): Buffer {
  let len: Buffer;
  if (content.length < 0x80) {
    len = Buffer.from([content.length]);
  } else if (content.length < 256) {
    len = Buffer.from([0x81, content.length]);
  } else {
    len = Buffer.alloc(3);
    len[0] = 0x82;
    len.writeUInt16BE(content.length, 1);
  }
  return Buffer.concat([Buffer.from([tag]), len, content]);
}

function derSeq(...children: Buffer[]): Buffer {
  return derTlv(0x30, Buffer.concat(children));
}

function derOid(oid: string): Buffer {
  const parts = oid.split('.').map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    if (p === 0) { bytes.push(0); continue; }
    const stack: number[] = [];
    let v = p;
    while (v > 0) { stack.unshift(v & 0x7f); v >>= 7; }
    for (let i = 0; i < stack.length - 1; i++) stack[i] |= 0x80;
    bytes.push(...stack);
  }
  return derTlv(0x06, Buffer.from(bytes));
}

function derName(entries: Array<[string, string]>): Buffer {
  return derSeq(...entries.map(([oid, value]) =>
    derTlv(0x31, derSeq(derOid(oid), derTlv(0x0c, Buffer.from(value, 'utf8'))))
  ));
}

function buildTestCert(): Buffer {
  const alg = derSeq(derOid('1.2.840.113549.1.1.11'), derTlv(0x05, Buffer.alloc(0)));
  const issuer = derName([['2.5.4.10', 'Test Signer Ltd'], ['2.5.4.3', 'Test Signer CA']]);
  const validity = derSeq(
    derTlv(0x17, Buffer.from('260101000000Z', 'latin1')),
    derTlv(0x17, Buffer.from('300101000000Z', 'latin1'))
  );
  const subject = derName([['2.5.4.3', 'Test Generator']]);
  const tbs = derSeq(
    derTlv(0xa0, derTlv(0x02, Buffer.from([2]))),
    derTlv(0x02, Buffer.from([1])),
    alg,
    issuer,
    validity,
    subject
  );
  return derSeq(tbs, alg, derTlv(0x03, Buffer.concat([Buffer.from([0]), Buffer.from('fakesig', 'latin1')])));
}

// --- JUMBF assembler ----------------------------------------------------------

function jumbfBox(type: string, content: Buffer): Buffer {
  const b = Buffer.alloc(8 + content.length);
  b.writeUInt32BE(8 + content.length, 0);
  b.write(type, 4, 'latin1');
  content.copy(b, 8);
  return b;
}

function jumdBox(label: string): Buffer {
  const content = Buffer.concat([
    Buffer.alloc(16, 0x63),
    Buffer.from([1]),
    Buffer.from(label, 'utf8'),
    Buffer.from([0])
  ]);
  return jumbfBox('jumd', content);
}

function superBox(label: string, children: Buffer[]): Buffer {
  return jumbfBox('jumb', Buffer.concat([jumdBox(label), ...children]));
}

function buildManifestStore(tamper: boolean): Buffer {
  const actions = {
    actions: [{
      action: 'c2pa.created',
      digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
      softwareAgent: 'TestGen 1.0'
    }]
  };
  let assertionBox = superBox('c2pa.actions', [jumbfBox('cbor', cborEncode(actions))]);
  const assertionHash = crypto.createHash('sha256').update(assertionBox).digest();
  if (tamper) {
    assertionBox = Buffer.from(assertionBox);
    const idx = assertionBox.indexOf('TestGen');
    assert.notEqual(idx, -1, 'fixture: TestGen string not found in assertion box');
    assertionBox[idx] = assertionBox[idx] ^ 0xff;
  }

  const claim = {
    claim_generator: 'TestGen',
    claim_generator_info: [{ name: 'TestGen', version: '1.0' }],
    instanceID: 'xmp:iid:00000000-0000-0000-0000-000000000000',
    signature: 'self#jumbf=/c2pa/signature',
    assertions: [{ url: 'self#jumbf=c2pa.assertions/c2pa.actions', hash: assertionHash }]
  };
  const cose = cborEncode([
    cborEncode(new Map([[1, -7]])),
    new Map([[33, [buildTestCert()]]]),
    null,
    Buffer.from('sig', 'latin1')
  ]);
  const manifest = superBox('c2pa_manifest:urn:uuid:test', [
    jumbfBox('c2cl', cborEncode(claim)),
    superBox('c2pa_assertions', [assertionBox]),
    jumbfBox('c2cs', cose)
  ]);
  return superBox('c2pa', [manifest]);
}

// --- Container embedding -------------------------------------------------------

function embedJpeg(store: Buffer): Buffer {
  const segLen = 2 + 8 + store.length;
  const seg = Buffer.alloc(2 + segLen);
  seg[0] = 0xff;
  seg[1] = 0xeb;
  seg.writeUInt16BE(segLen, 2);
  seg.write('JP', 4, 'latin1');
  seg.writeUInt16BE(1, 6);
  seg.writeUInt32BE(store.length, 8);
  store.copy(seg, 12);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg, Buffer.from([0xff, 0xd9])]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function embedPng(store: Buffer): Buffer {
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', Buffer.alloc(13)),
    pngChunk('caBX', store),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function plainJpeg(): Buffer {
  const app0 = Buffer.alloc(18);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  app0.writeUInt16BE(16, 2);
  app0.write('JFIF\0', 4, 'latin1');
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, Buffer.from([0xff, 0xd9])]);
}

function plainPng(): Buffer {
  return Buffer.concat([PNG_SIG, pngChunk('IHDR', Buffer.alloc(13)), pngChunk('IEND', Buffer.alloc(0))]);
}

function xmpJpeg(): Buffer {
  const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" '
    + 'xmp:CreatorTool="Midjourney" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/>'
    + '</rdf:RDF></x:xmpmeta>';
  const payload = Buffer.concat([
    Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'),
    Buffer.from(xmp, 'utf8')
  ]);
  const seg = Buffer.alloc(4 + payload.length);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  seg.writeUInt16BE(payload.length + 2, 2);
  payload.copy(seg, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg, Buffer.from([0xff, 0xd9])]);
}

// --- Tests ----------------------------------------------------------------------

async function run(): Promise<void> {
  // C2PA-absent fixtures: supported formats, no manifest anywhere.
  const absentJpeg = await analyzeProvenance(plainJpeg(), 'document');
  assert.equal(absentJpeg.c2pa, 'absent');
  assert.equal(absentJpeg.c2paDetails, undefined);
  assert.equal(absentJpeg.iptcSourceType, undefined);
  assert.deepEqual(absentJpeg.aiMetadataHints, []);
  assert.equal(absentJpeg.checkedAs, 'document');

  const absentPng = await analyzeProvenance(plainPng(), 'photo');
  assert.equal(absentPng.c2pa, 'absent');
  assert.equal(absentPng.checkedAs, 'photo');

  // C2PA-present fixtures: manifest parses, assertion hash verifies,
  // claim generator / signer / digital source type are extracted. This
  // is the presence+parse+integrity level — NOT signature validation.
  const store = buildManifestStore(false);
  const validJpeg = await analyzeProvenance(embedJpeg(store), 'document');
  assert.equal(validJpeg.c2pa, 'valid');
  assert.equal(validJpeg.c2paDetails?.claimGenerator, 'TestGen');
  assert.equal(validJpeg.c2paDetails?.signer, 'Test Signer Ltd');
  assert.match(validJpeg.c2paDetails?.digitalSourceType || '', /trainedAlgorithmicMedia/);
  assert.equal(validJpeg.c2paDetails?.assertionsVerified, true);
  assert.equal(validJpeg.c2paDetails?.manifestCount, 1);

  const validPng = await analyzeProvenance(embedPng(store), 'document');
  assert.equal(validPng.c2pa, 'valid');
  assert.equal(validPng.c2paDetails?.claimGenerator, 'TestGen');
  assert.equal(validPng.c2paDetails?.assertionsVerified, true);

  // Tampered assertion: the claim's hash no longer matches the stored
  // assertion box, so the manifest is invalid — never "valid".
  const tampered = await analyzeProvenance(embedJpeg(buildManifestStore(true)), 'document');
  assert.equal(tampered.c2pa, 'invalid');
  assert.equal(tampered.c2paDetails?.assertionsVerified, false);

  // Metadata fixture: XMP carries an IPTC digital source type and an AI
  // CreatorTool; both must surface without any C2PA manifest present.
  const xmp = await analyzeProvenance(xmpJpeg(), 'document');
  assert.equal(xmp.c2pa, 'absent');
  assert.equal(xmp.iptcSourceType, 'trainedAlgorithmicMedia');
  assert.ok(
    xmp.aiMetadataHints.some(h => h.includes('Midjourney')),
    `expected a Midjourney metadata hint, got: ${JSON.stringify(xmp.aiMetadataHints)}`
  );

  // Malformed / truncated files: an honest error or unsupported, never
  // a crash and never a fabricated verdict.
  const fullJpeg = embedJpeg(store);
  const truncatedJpeg = await analyzeProvenance(fullJpeg.subarray(0, fullJpeg.length - 10), 'document');
  assert.equal(truncatedJpeg.c2pa, 'error');

  const caBxHeader = Buffer.alloc(8);
  caBxHeader.writeUInt32BE(store.length, 0);
  caBxHeader.write('caBX', 4, 'latin1');
  const truncatedPng = await analyzeProvenance(
    Buffer.concat([PNG_SIG, pngChunk('IHDR', Buffer.alloc(13)), caBxHeader, store.subarray(0, 10)]),
    'document'
  );
  assert.equal(truncatedPng.c2pa, 'error');

  const garbage = await analyzeProvenance(Buffer.from('this is not an image at all', 'latin1'), 'document');
  assert.equal(garbage.c2pa, 'unsupported');
  const empty = await analyzeProvenance(Buffer.alloc(0), 'photo');
  assert.equal(empty.c2pa, 'unsupported');

  // Formatting invariants: the provenance section is separate from the
  // Sightengine verdict, and the SynthID line is present and honestly
  // worded (the bot does NOT claim to detect SynthID).
  const absentPhotoSection = formatProvenanceSection(absentPng);
  assert.match(absentPhotoSection, /Provenance/);
  assert.match(absentPhotoSection, /separate from the AI-detection verdict/);
  assert.ok(absentPhotoSection.includes(SYNTHID_LINE));
  assert.match(absentPhotoSection, /SynthID watermark can't be checked inside this bot/);
  assert.match(absentPhotoSection, /synthid\.com/);
  assert.doesNotMatch(absentPhotoSection, /SynthID[^\n]*\b(detected|found|present|confirmed)\b/i);
  // Sent as a Telegram photo with no credentials: the preserve-as-file
  // hint appears. Sent as a document it does not.
  assert.match(absentPhotoSection, /file\/document/);
  const absentDocSection = formatProvenanceSection(absentJpeg);
  assert.doesNotMatch(absentDocSection, /Telegram photo/);
  assert.match(absentDocSection, /Content Credentials \(C2PA\): none found/);

  const validSection = formatProvenanceSection(validJpeg);
  assert.match(validSection, /Content Credentials \(C2PA\): found/);
  assert.match(validSection, /TestGen/);
  assert.match(validSection, /Test Signer Ltd/);
  assert.match(validSection, /integrity hashes match/);
  assert.match(validSection, /does not cryptographically verify the signature/);
  assert.match(validSection, /generated by AI/);
  assert.doesNotMatch(validSection, /signature (has been |was )?verified/i);

  const invalidSection = formatProvenanceSection(tampered);
  assert.match(invalidSection, /found but not trustworthy/);

  const xmpSection = formatProvenanceSection(xmp);
  assert.match(xmpSection, /Declared source \(IPTC metadata\)/);
  assert.match(xmpSection, /Midjourney/);

  // Integration pins (source-level, same precedent as handler-outcomes):
  // the image handler runs provenance on the downloaded buffer and
  // appends the section to both result messages, and the provenance
  // service does not depend on the Sightengine service.
  const imageSource = fs.readFileSync(path.join(__dirname, '../src/handlers/image.ts'), 'utf8');
  assert.ok(imageSource.includes("from '../services/provenance'"), 'image.ts: provenance import missing');
  assert.ok(imageSource.includes('analyzeProvenance(imageBuffer'), 'image.ts: analyzeProvenance not run on the image buffer');
  assert.ok(imageSource.includes('formatProvenanceSection(provenance)'), 'image.ts: provenance section not formatted');
  const provenanceSource = fs.readFileSync(path.join(__dirname, '../src/services/provenance.ts'), 'utf8');
  assert.doesNotMatch(provenanceSource, /import .* from .*sightengine/, 'provenance.ts must not import the Sightengine service');

  console.log('Provenance assertions passed');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
