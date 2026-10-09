/** Key algorithms the generator can produce. */
export type KeyType = 'ed25519' | 'rsa' | 'ecdsa';

/** Options for a single key pair generation. */
export interface GenerateOptions {
  type: KeyType;
  /** RSA: 2048 | 3072 | 4096. ECDSA: 256 | 384 | 521. Ignored for Ed25519. */
  bits?: number;
  comment?: string;
  /** Empty string or undefined leaves the private key unencrypted. */
  passphrase?: string;
  /** bcrypt_pbkdf rounds used when a passphrase is set, defaults to 16 like ssh-keygen. */
  rounds?: number;
}

/** A generated key pair, every field ready to copy or save. */
export interface KeyPair {
  type: KeyType;
  bits: number;
  /** The `ssh-keytype` algorithm name, e.g. `ssh-ed25519` or `ecdsa-sha2-nistp256`. */
  algorithm: string;
  comment: string;
  encrypted: boolean;
  /** One line in authorized_keys format, ending with a newline. */
  publicKey: string;
  /** `-----BEGIN OPENSSH PRIVATE KEY-----` block, ending with a newline. */
  privateKey: string;
  /** `SHA256:` base64 fingerprint without padding, as ssh-keygen -l prints. */
  fingerprint: string;
  /** The ssh-keygen visual host key art, lines joined with `\n`. */
  randomart: string;
  /** Default file name: `id_ed25519`, `id_rsa` or `id_ecdsa`. */
  fileName: string;
}
