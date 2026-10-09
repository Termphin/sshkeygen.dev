import { bcryptPbkdf } from './bcrypt-pbkdf';
import type { RawKey } from './keys';
import { base64Encode, randomBytes, SshWriter, utf8 } from './wire';

const AUTH_MAGIC = utf8('openssh-key-v1\0');
const PEM_BEGIN = '-----BEGIN OPENSSH PRIVATE KEY-----';
const PEM_END = '-----END OPENSSH PRIVATE KEY-----';
const PEM_LINE = 70;
const CIPHER = 'aes256-ctr';
const KDF = 'bcrypt';
const SALT_SIZE = 16;
const AES_KEY_SIZE = 32;
const AES_IV_SIZE = 16;
const AES_BLOCK_SIZE = 16;
const PLAIN_BLOCK_SIZE = 8;

/** Default bcrypt_pbkdf rounds, the same as ssh-keygen. */
export const DEFAULT_ROUNDS = 16;

function privateSection(key: RawKey, comment: string, blockSize: number): Uint8Array<ArrayBuffer> {
  const check = new DataView(randomBytes(4).buffer).getUint32(0);
  const writer = new SshWriter().uint32(check).uint32(check).raw(key.privateFields).string(comment);
  const unpadded = writer.bytes();
  const padding = new Uint8Array((blockSize - (unpadded.length % blockSize)) % blockSize);
  for (let i = 0; i < padding.length; i++) padding[i] = i + 1;
  return writer.raw(padding).bytes();
}

async function encryptSection(
  section: Uint8Array<ArrayBuffer>,
  passphrase: string,
  salt: Uint8Array,
  rounds: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const derived = await bcryptPbkdf(utf8(passphrase), salt, AES_KEY_SIZE + AES_IV_SIZE, rounds);
  const subtle = globalThis.crypto.subtle;
  const aesKey = await subtle.importKey('raw', derived.slice(0, AES_KEY_SIZE), { name: 'AES-CTR' }, false, ['encrypt']);
  const counter = derived.slice(AES_KEY_SIZE);
  const encrypted = await subtle.encrypt({ name: 'AES-CTR', counter, length: 128 }, aesKey, section);
  return new Uint8Array(encrypted);
}

/** Wraps base64 in the PEM armor ssh-keygen writes, 70 characters per line. */
export function pemArmor(body: Uint8Array): string {
  const encoded = base64Encode(body);
  const lines = [PEM_BEGIN];
  for (let i = 0; i < encoded.length; i += PEM_LINE) lines.push(encoded.slice(i, i + PEM_LINE));
  lines.push(PEM_END);
  return `${lines.join('\n')}\n`;
}

/**
 * Serialises a key as an openssh-key-v1 private key file. A non-empty passphrase encrypts it
 * with aes256-ctr under a bcrypt_pbkdf-derived key, as `ssh-keygen -N` does.
 */
export async function privateKeyFile(
  key: RawKey,
  comment: string,
  passphrase = '',
  rounds = DEFAULT_ROUNDS,
): Promise<string> {
  const writer = new SshWriter().raw(AUTH_MAGIC);
  if (passphrase === '') {
    writer.string('none').string('none').string(new Uint8Array(0));
    writer.uint32(1).string(key.publicBlob).string(privateSection(key, comment, PLAIN_BLOCK_SIZE));
  } else {
    const salt = randomBytes(SALT_SIZE);
    const section = privateSection(key, comment, AES_BLOCK_SIZE);
    writer.string(CIPHER).string(KDF).string(new SshWriter().string(salt).uint32(rounds).bytes());
    writer.uint32(1).string(key.publicBlob).string(await encryptSection(section, passphrase, salt, rounds));
  }
  return pemArmor(writer.bytes());
}
