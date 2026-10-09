import { sha256 } from '@noble/hashes/sha2.js';
import { base64Decode, base64Encode, SshReader } from './wire';

/** `SHA256:` followed by the unpadded base64 SHA-256 of a public key blob, as ssh-keygen -l prints. */
export function sha256Fingerprint(publicBlob: Uint8Array): string {
  return `SHA256:${base64Encode(sha256(publicBlob)).replace(/=+$/, '')}`;
}

/** A public key line split into its algorithm, blob and comment. */
export interface ParsedPublicKey {
  algorithm: string;
  blob: Uint8Array;
  comment: string;
}

const ALGORITHM_PATTERN = /^(ssh-[a-z0-9-]+|ecdsa-sha2-[a-z0-9-]+|sk-[a-z0-9-]+@openssh\.com)(-cert-v01@openssh\.com)?$/;

/**
 * Parses a line in authorized_keys or `.pub` format, skipping any leading options.
 * Throws when no key is found or the blob does not name the same algorithm as the line.
 */
export function parsePublicKeyLine(line: string): ParsedPublicKey {
  const tokens = line.trim().split(/\s+/);
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (!ALGORITHM_PATTERN.test(tokens[i])) continue;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(tokens[i + 1])) continue;
    const blob = base64Decode(tokens[i + 1]);
    let inner: string;
    try {
      inner = new SshReader(blob).text();
    } catch {
      continue;
    }
    if (inner !== tokens[i]) throw new Error(`Key data is ${inner}, but the line says ${tokens[i]}`);
    return { algorithm: tokens[i], blob, comment: tokens.slice(i + 2).join(' ') };
  }
  throw new Error('No SSH public key found');
}
