import { ed25519 } from '@noble/curves/ed25519.js';
import type { KeyType } from './types';
import { base64Decode, concatBytes, padStart, randomBytes, SshWriter } from './wire';

/** Key material in SSH wire format, before it is wrapped for files. */
export interface RawKey {
  type: KeyType;
  bits: number;
  algorithm: string;
  /** The public key blob, as it appears base64-encoded in authorized_keys. */
  publicBlob: Uint8Array;
  /** The key's entry in the openssh-key-v1 private section: key type and fields, without checkints or comment. */
  privateFields: Uint8Array;
}

/** RSA modulus sizes the generator accepts. */
export const RSA_BITS = [2048, 3072, 4096] as const;

/** ECDSA curve sizes the generator accepts. */
export const ECDSA_BITS = [256, 384, 521] as const;

const ECDSA_CURVES: Record<number, { webCrypto: string; ssh: string; fieldSize: number }> = {
  256: { webCrypto: 'P-256', ssh: 'nistp256', fieldSize: 32 },
  384: { webCrypto: 'P-384', ssh: 'nistp384', fieldSize: 48 },
  521: { webCrypto: 'P-521', ssh: 'nistp521', fieldSize: 66 },
};

function jwkField(jwk: JsonWebKey, name: keyof JsonWebKey): Uint8Array<ArrayBuffer> {
  const value = jwk[name];
  if (typeof value !== 'string') throw new Error(`Exported key has no "${name}" field`);
  return base64Decode(value);
}

function bitLength(unsigned: Uint8Array): number {
  let start = 0;
  while (start < unsigned.length && unsigned[start] === 0) start++;
  if (start === unsigned.length) return 0;
  return (unsigned.length - start - 1) * 8 + (32 - Math.clz32(unsigned[start]));
}

/** Generates an Ed25519 key from a random 32-byte seed. */
export function generateEd25519(): RawKey {
  const algorithm = 'ssh-ed25519';
  const seed = randomBytes(32);
  const publicKey = ed25519.getPublicKey(seed);
  return {
    type: 'ed25519',
    bits: 256,
    algorithm,
    publicBlob: new SshWriter().string(algorithm).string(publicKey).bytes(),
    privateFields: new SshWriter()
      .string(algorithm)
      .string(publicKey)
      .string(concatBytes(seed, publicKey))
      .bytes(),
  };
}

/** Generates an RSA key with public exponent 65537 through WebCrypto. */
export async function generateRsa(bits: number): Promise<RawKey> {
  if (!(RSA_BITS as readonly number[]).includes(bits)) throw new Error(`Unsupported RSA key size: ${bits}`);
  const algorithm = 'ssh-rsa';
  const pair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey);
  const n = jwkField(jwk, 'n');
  const e = jwkField(jwk, 'e');
  return {
    type: 'rsa',
    bits: bitLength(n),
    algorithm,
    publicBlob: new SshWriter().string(algorithm).mpint(e).mpint(n).bytes(),
    privateFields: new SshWriter()
      .string(algorithm)
      .mpint(n)
      .mpint(e)
      .mpint(jwkField(jwk, 'd'))
      .mpint(jwkField(jwk, 'qi'))
      .mpint(jwkField(jwk, 'p'))
      .mpint(jwkField(jwk, 'q'))
      .bytes(),
  };
}

/** Generates an ECDSA key on NIST P-256, P-384 or P-521 through WebCrypto. */
export async function generateEcdsa(bits: number): Promise<RawKey> {
  const curve = ECDSA_CURVES[bits];
  if (!curve) throw new Error(`Unsupported ECDSA key size: ${bits}`);
  const algorithm = `ecdsa-sha2-${curve.ssh}`;
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: curve.webCrypto },
    true,
    ['sign', 'verify'],
  );
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey);
  const point = concatBytes(
    new Uint8Array([4]),
    padStart(jwkField(jwk, 'x'), curve.fieldSize),
    padStart(jwkField(jwk, 'y'), curve.fieldSize),
  );
  return {
    type: 'ecdsa',
    bits,
    algorithm,
    publicBlob: new SshWriter().string(algorithm).string(curve.ssh).string(point).bytes(),
    privateFields: new SshWriter()
      .string(algorithm)
      .string(curve.ssh)
      .string(point)
      .mpint(jwkField(jwk, 'd'))
      .bytes(),
  };
}
