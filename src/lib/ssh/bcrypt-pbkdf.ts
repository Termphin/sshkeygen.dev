import { sha512 } from '@noble/hashes/sha2.js';
import { Blowfish, WordStream } from './blowfish';

const HASH_WORDS = 8;
const HASH_SIZE = HASH_WORDS * 4;
const MAGIC = new TextEncoder().encode('OxychromaticBlowfishSwatDynamite');

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The bcrypt core used by bcrypt_pbkdf: 32 bytes from SHA-512 digests of the password and salt. */
export function bcryptHash(sha2pass: Uint8Array, sha2salt: Uint8Array): Uint8Array {
  const state = Blowfish.initial();
  state.expandState(sha2salt, sha2pass);
  for (let i = 0; i < 64; i++) {
    state.expand0State(sha2salt);
    state.expand0State(sha2pass);
  }
  const magic = new WordStream(MAGIC);
  const cdata = new Uint32Array(HASH_WORDS);
  for (let i = 0; i < HASH_WORDS; i++) cdata[i] = magic.next();
  for (let i = 0; i < 64; i++) {
    for (let block = 0; block < HASH_WORDS; block += 2) {
      state.encryptBlock(cdata, block);
    }
  }
  const out = new Uint8Array(HASH_SIZE);
  for (let i = 0; i < HASH_WORDS; i++) {
    out[4 * i] = cdata[i] & 0xff;
    out[4 * i + 1] = (cdata[i] >>> 8) & 0xff;
    out[4 * i + 2] = (cdata[i] >>> 16) & 0xff;
    out[4 * i + 3] = (cdata[i] >>> 24) & 0xff;
  }
  return out;
}

/**
 * bcrypt_pbkdf as OpenSSH implements it (openbsd-compat/bcrypt_pbkdf.c), yielding to the
 * event loop between bcrypt rounds so a page stays responsive.
 */
export async function bcryptPbkdf(
  password: Uint8Array,
  salt: Uint8Array,
  keyLength: number,
  rounds: number,
): Promise<Uint8Array> {
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error('bcrypt_pbkdf needs at least one round');
  if (password.length === 0 || salt.length === 0) throw new Error('bcrypt_pbkdf needs a password and a salt');
  if (keyLength < 1 || keyLength > HASH_SIZE * HASH_SIZE) throw new Error('bcrypt_pbkdf key length out of range');

  const key = new Uint8Array(keyLength);
  const stride = Math.ceil(keyLength / HASH_SIZE);
  let amount = Math.ceil(keyLength / stride);
  const sha2pass = sha512(password);
  const countSalt = new Uint8Array(salt.length + 4);
  countSalt.set(salt);
  let remaining = keyLength;

  for (let count = 1; remaining > 0; count++) {
    new DataView(countSalt.buffer).setUint32(salt.length, count);
    let tmp = bcryptHash(sha2pass, sha512(countSalt));
    const out = tmp.slice();
    await yieldToEventLoop();
    for (let round = 1; round < rounds; round++) {
      tmp = bcryptHash(sha2pass, sha512(tmp));
      for (let j = 0; j < HASH_SIZE; j++) out[j] ^= tmp[j];
      await yieldToEventLoop();
    }
    amount = Math.min(amount, remaining);
    let i = 0;
    for (; i < amount; i++) {
      const dest = i * stride + (count - 1);
      if (dest >= keyLength) break;
      key[dest] = out[i];
    }
    remaining -= i;
  }
  return key;
}
