import { sha256 } from '@noble/hashes/sha2.js';
import { DEFAULT_ROUNDS, privateKeyFile } from './armor';
import { sha256Fingerprint, parsePublicKeyLine } from './fingerprint';
import { generateEcdsa, generateEd25519, generateRsa, type RawKey } from './keys';
import { randomart } from './randomart';
import type { GenerateOptions, KeyPair, KeyType } from './types';
import { base64Encode } from './wire';

export * from './types';
export { DEFAULT_ROUNDS } from './armor';
export { ECDSA_BITS, RSA_BITS } from './keys';

/** The key size used when `GenerateOptions.bits` is not given. */
export const DEFAULT_BITS: Record<KeyType, number> = {
  ed25519: 256,
  rsa: 4096,
  ecdsa: 256,
};

const FILE_NAMES: Record<KeyType, string> = {
  ed25519: 'id_ed25519',
  rsa: 'id_rsa',
  ecdsa: 'id_ecdsa',
};

const RANDOMART_LABELS: Record<KeyType, string> = {
  ed25519: 'ED25519',
  rsa: 'RSA',
  ecdsa: 'ECDSA',
};

/** True when the runtime has the WebCrypto pieces the generator needs. */
export function isSupported(): boolean {
  const crypto = globalThis.crypto;
  return (
    typeof crypto?.getRandomValues === 'function' &&
    typeof crypto.subtle?.generateKey === 'function' &&
    typeof crypto.subtle.exportKey === 'function' &&
    typeof crypto.subtle.encrypt === 'function'
  );
}

function generateRaw(type: KeyType, bits: number): Promise<RawKey> | RawKey {
  switch (type) {
    case 'ed25519':
      return generateEd25519();
    case 'rsa':
      return generateRsa(bits);
    case 'ecdsa':
      return generateEcdsa(bits);
    default:
      throw new Error(`Unsupported key type: ${type as string}`);
  }
}

/**
 * Generates a key pair in OpenSSH formats. With a passphrase the private key is encrypted with
 * aes256-ctr and bcrypt_pbkdf; that derivation takes most of the time and grows linearly with `rounds`.
 */
export async function generateKeyPair(options: GenerateOptions): Promise<KeyPair> {
  const bits = options.bits ?? DEFAULT_BITS[options.type];
  const comment = options.comment ?? '';
  const passphrase = options.passphrase ?? '';
  const rounds = options.rounds ?? DEFAULT_ROUNDS;
  if (passphrase !== '' && (!Number.isInteger(rounds) || rounds < 1)) {
    throw new Error(`Invalid bcrypt rounds: ${rounds}`);
  }

  const key = await generateRaw(options.type, bits);
  const blob = base64Encode(key.publicBlob);
  return {
    type: key.type,
    bits: key.bits,
    algorithm: key.algorithm,
    comment,
    encrypted: passphrase !== '',
    publicKey: comment === '' ? `${key.algorithm} ${blob}\n` : `${key.algorithm} ${blob} ${comment}\n`,
    privateKey: await privateKeyFile(key, comment, passphrase, rounds),
    fingerprint: sha256Fingerprint(key.publicBlob),
    randomart: randomart(RANDOMART_LABELS[key.type], key.bits, sha256(key.publicBlob)),
    fileName: FILE_NAMES[key.type],
  };
}

/** The `SHA256:` fingerprint of any public key line, as `ssh-keygen -l` prints it. */
export async function fingerprintOf(publicKeyLine: string): Promise<string> {
  return sha256Fingerprint(parsePublicKeyLine(publicKeyLine).blob);
}
