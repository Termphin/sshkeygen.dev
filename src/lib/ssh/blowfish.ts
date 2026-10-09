import { PI_HEX } from './blowfish-tables';

const ROUNDS = 16;
const P_SIZE = ROUNDS + 2;
const S_SIZE = 4 * 256;

let initialTables: Uint32Array | undefined;

function piWords(): Uint32Array {
  if (!initialTables) {
    initialTables = new Uint32Array(P_SIZE + S_SIZE);
    for (let i = 0; i < initialTables.length; i++) {
      initialTables[i] = parseInt(PI_HEX.slice(i * 8, i * 8 + 8), 16);
    }
  }
  return initialTables;
}

/** A cursor over a byte stream that wraps around, as OpenBSD's Blowfish_stream2word reads it. */
export class WordStream {
  private position = 0;

  constructor(private readonly data: Uint8Array) {}

  /** The next big-endian 32-bit word, wrapping to the start of the stream when it runs out. */
  next(): number {
    let word = 0;
    for (let i = 0; i < 4; i++) {
      if (this.position >= this.data.length) this.position = 0;
      word = ((word << 8) | this.data[this.position++]) >>> 0;
    }
    return word;
  }
}

/** Blowfish block cipher state, with the plain and the bcrypt "expensive" key schedules. */
export class Blowfish {
  readonly p = new Uint32Array(P_SIZE);
  readonly s = new Uint32Array(S_SIZE);
  private readonly block = new Uint32Array(2);

  /** A state holding the initial pi-derived tables, before any key is applied. */
  static initial(): Blowfish {
    const cipher = new Blowfish();
    const words = piWords();
    cipher.p.set(words.subarray(0, P_SIZE));
    cipher.s.set(words.subarray(P_SIZE));
    return cipher;
  }

  /** A cipher keyed with the standard Blowfish key schedule. */
  static withKey(key: Uint8Array): Blowfish {
    const cipher = Blowfish.initial();
    cipher.expand0State(key);
    return cipher;
  }

  /** Encrypts the 64-bit block held in `words[offset]` (left) and `words[offset + 1]` (right) in place. */
  encryptBlock(words: Uint32Array, offset: number): void {
    const p = this.p;
    const s = this.s;
    let left = words[offset] ^ p[0];
    let right = words[offset + 1];
    for (let i = 1; i <= ROUNDS; i += 2) {
      right ^= ((((s[left >>> 24] + s[256 | ((left >>> 16) & 0xff)]) ^ s[512 | ((left >>> 8) & 0xff)]) + s[768 | (left & 0xff)]) ^ p[i]);
      left ^= ((((s[right >>> 24] + s[256 | ((right >>> 16) & 0xff)]) ^ s[512 | ((right >>> 8) & 0xff)]) + s[768 | (right & 0xff)]) ^ p[i + 1]);
    }
    words[offset] = (right ^ p[P_SIZE - 1]) >>> 0;
    words[offset + 1] = left >>> 0;
  }

  /** Mixes `key` into the state, as OpenBSD's Blowfish_expand0state. */
  expand0State(key: Uint8Array): void {
    this.xorKey(key);
    this.refill(null);
  }

  /** Mixes `key` and `data` into the state, as OpenBSD's Blowfish_expandstate. */
  expandState(data: Uint8Array, key: Uint8Array): void {
    this.xorKey(key);
    this.refill(new WordStream(data));
  }

  private xorKey(key: Uint8Array): void {
    const stream = new WordStream(key);
    for (let i = 0; i < P_SIZE; i++) {
      this.p[i] = (this.p[i] ^ stream.next()) >>> 0;
    }
  }

  private refill(data: WordStream | null): void {
    const block = this.block;
    block[0] = 0;
    block[1] = 0;
    this.fill(this.p, data);
    this.fill(this.s, data);
  }

  private fill(table: Uint32Array, data: WordStream | null): void {
    const block = this.block;
    for (let i = 0; i < table.length; i += 2) {
      if (data) {
        block[0] ^= data.next();
        block[1] ^= data.next();
      }
      this.encryptBlock(block, 0);
      table[i] = block[0];
      table[i + 1] = block[1];
    }
  }
}
