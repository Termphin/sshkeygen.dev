const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** UTF-8 bytes of a string. */
export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(text) as Uint8Array<ArrayBuffer>;
}

/** Concatenates byte arrays. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Cryptographically random bytes from the platform's CSPRNG. */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** Standard base64 with padding. */
export function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Decodes standard or URL-safe base64, with or without padding. */
export function base64Decode(text: string): Uint8Array<ArrayBuffer> {
  let normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) normalized += '=';
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** An unsigned big-endian integer as an SSH mpint body: leading zeros stripped, a zero byte prepended if the high bit is set. */
export function mpintBytes(unsigned: Uint8Array): Uint8Array<ArrayBuffer> {
  let start = 0;
  while (start < unsigned.length && unsigned[start] === 0) start++;
  const trimmed = unsigned.subarray(start);
  if (trimmed.length > 0 && trimmed[0] & 0x80) return concatBytes(new Uint8Array([0]), trimmed);
  return concatBytes(trimmed);
}

/** Left-pads an unsigned big-endian integer with zeros to `length` bytes. */
export function padStart(bytes: Uint8Array, length: number): Uint8Array<ArrayBuffer> {
  if (bytes.length > length) throw new Error('Value is longer than its field');
  const out = new Uint8Array(length);
  out.set(bytes, length - bytes.length);
  return out;
}

/** Builds an SSH wire-format buffer (RFC 4251). */
export class SshWriter {
  private readonly parts: Uint8Array[] = [];

  /** Appends a big-endian uint32. */
  uint32(value: number): this {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0);
    this.parts.push(out);
    return this;
  }

  /** Appends a length-prefixed string; text is encoded as UTF-8. */
  string(value: Uint8Array | string): this {
    const bytes = typeof value === 'string' ? utf8(value) : value;
    this.uint32(bytes.length);
    this.parts.push(bytes);
    return this;
  }

  /** Appends an mpint from an unsigned big-endian integer. */
  mpint(unsigned: Uint8Array): this {
    return this.string(mpintBytes(unsigned));
  }

  /** Appends bytes without a length prefix. */
  raw(bytes: Uint8Array): this {
    this.parts.push(bytes);
    return this;
  }

  /** The bytes written so far. */
  bytes(): Uint8Array<ArrayBuffer> {
    return concatBytes(...this.parts);
  }
}

/** Reads an SSH wire-format buffer (RFC 4251). */
export class SshReader {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  /** Reads a big-endian uint32. */
  uint32(): number {
    if (this.offset + 4 > this.data.length) throw new Error('Unexpected end of data');
    const value = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4).getUint32(0);
    this.offset += 4;
    return value;
  }

  /** Reads a length-prefixed byte string. */
  string(): Uint8Array {
    const length = this.uint32();
    return this.raw(length);
  }

  /** Reads a length-prefixed string as UTF-8 text. */
  text(): string {
    return textDecoder.decode(this.string());
  }

  /** Reads `length` bytes without a length prefix. */
  raw(length: number): Uint8Array {
    if (this.offset + length > this.data.length) throw new Error('Unexpected end of data');
    const value = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  /** Bytes not yet read. */
  remaining(): number {
    return this.data.length - this.offset;
  }
}
