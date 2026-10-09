import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bcryptPbkdf } from '../src/lib/ssh/bcrypt-pbkdf';
import { Blowfish } from '../src/lib/ssh/blowfish';
import { DEFAULT_BITS, fingerprintOf, generateKeyPair, isSupported, type KeyPair, type KeyType } from '../src/lib/ssh';
import { base64Decode, SshReader, utf8 } from '../src/lib/ssh/wire';

const SSH_KEYGEN = '/usr/bin/ssh-keygen';
const workDir = mkdtempSync(join(tmpdir(), 'sshkeygen-dev-'));
let fileCounter = 0;

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

function keygen(...args: string[]): string {
  return execFileSync(SSH_KEYGEN, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function writeKeyFiles(pair: KeyPair): { privatePath: string; publicPath: string } {
  const privatePath = join(workDir, `${pair.fileName}_${fileCounter++}`);
  const publicPath = `${privatePath}.pub`;
  writeFileSync(privatePath, pair.privateKey, { mode: 0o600 });
  writeFileSync(publicPath, pair.publicKey, { mode: 0o644 });
  return { privatePath, publicPath };
}

function keyWithoutComment(line: string): string {
  return line.trim().split(/\s+/).slice(0, 2).join(' ');
}

function hexBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/../g)!.map((byte) => parseInt(byte, 16)));
}

const cases: Array<{ type: KeyType; bits: number; label: string }> = [
  { type: 'ed25519', bits: 256, label: 'ED25519' },
  { type: 'rsa', bits: 2048, label: 'RSA' },
  { type: 'rsa', bits: 4096, label: 'RSA' },
  { type: 'ecdsa', bits: 256, label: 'ECDSA' },
  { type: 'ecdsa', bits: 384, label: 'ECDSA' },
  { type: 'ecdsa', bits: 521, label: 'ECDSA' },
];

describe('generateKeyPair matches ssh-keygen', () => {
  for (const { type, bits, label } of cases) {
    for (const passphrase of ['', 'correct horse battery staple']) {
      const name = `${type} ${bits} ${passphrase ? 'encrypted' : 'plain'}`;
      it(name, { timeout: 120_000 }, async () => {
        const comment = `test@${type}-${bits}`;
        const pair = await generateKeyPair({ type, bits, comment, passphrase });
        expect(pair.bits).toBe(bits);
        expect(pair.encrypted).toBe(passphrase !== '');
        expect(pair.publicKey.endsWith(` ${comment}\n`)).toBe(true);
        expect(pair.privateKey.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----\n')).toBe(true);
        expect(pair.privateKey.endsWith('-----END OPENSSH PRIVATE KEY-----\n')).toBe(true);
        for (const line of pair.privateKey.trimEnd().split('\n')) expect(line.length).toBeLessThanOrEqual(70);

        const { privatePath, publicPath } = writeKeyFiles(pair);

        const derived = keygen('-y', '-P', passphrase, '-f', privatePath);
        expect(keyWithoutComment(derived)).toBe(keyWithoutComment(pair.publicKey));

        const listed = keygen('-l', '-f', publicPath).trim().split(' ');
        expect(listed[0]).toBe(String(bits));
        expect(listed[1]).toBe(pair.fingerprint);
        expect(listed[listed.length - 1]).toBe(`(${label})`);

        const visual = keygen('-lv', '-f', publicPath).trimEnd().split('\n').slice(1).join('\n');
        expect(pair.randomart).toBe(visual);

        if (passphrase) {
          const wrong = spawnSync(SSH_KEYGEN, ['-y', '-P', 'wrong passphrase', '-f', privatePath], { encoding: 'utf8' });
          expect(wrong.status).not.toBe(0);
          const none = spawnSync(SSH_KEYGEN, ['-y', '-P', '', '-f', privatePath], { encoding: 'utf8' });
          expect(none.status).not.toBe(0);
        }
      });
    }
  }

  it('omits the trailing space when there is no comment', async () => {
    const pair = await generateKeyPair({ type: 'ed25519' });
    expect(pair.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/]+=*\n$/);
    expect(pair.comment).toBe('');
    expect(pair.fileName).toBe('id_ed25519');
  });

  it('honours custom bcrypt rounds', { timeout: 60_000 }, async () => {
    const pair = await generateKeyPair({ type: 'ed25519', passphrase: 'pw', rounds: 3 });
    const { privatePath } = writeKeyFiles(pair);
    expect(keyWithoutComment(keygen('-y', '-P', 'pw', '-f', privatePath))).toBe(keyWithoutComment(pair.publicKey));
  });

  it('rejects unsupported sizes', async () => {
    await expect(generateKeyPair({ type: 'rsa', bits: 1024 })).rejects.toThrow();
    await expect(generateKeyPair({ type: 'ecdsa', bits: 512 })).rejects.toThrow();
  });

  it('exposes defaults and support detection', () => {
    expect(DEFAULT_BITS).toEqual({ ed25519: 256, rsa: 4096, ecdsa: 256 });
    expect(isSupported()).toBe(true);
  });
});

describe('fingerprintOf', () => {
  for (const [type, bits] of [['ed25519', '256'], ['rsa', '3072'], ['ecdsa', '384']] as const) {
    it(`matches ssh-keygen for a ${type} key it made`, { timeout: 60_000 }, () => {
      const path = join(workDir, `native_${type}`);
      keygen('-q', '-t', type, '-b', bits, '-N', '', '-C', 'native key', '-f', path);
      const expected = keygen('-l', '-f', `${path}.pub`).split(' ')[1];
      const line = readFileSync(`${path}.pub`, 'utf8');
      return Promise.all([
        expect(fingerprintOf(line)).resolves.toBe(expected),
        expect(fingerprintOf(`no-pty,command="echo hi" ${line}`)).resolves.toBe(expected),
      ]);
    });
  }

  it('rejects text that is not a key', async () => {
    await expect(fingerprintOf('hello world')).rejects.toThrow();
    await expect(fingerprintOf('ssh-rsa AAAAC3NzaC1lZDI1NTE5AAAAIA==')).rejects.toThrow();
  });
});

describe('Blowfish', () => {
  const vectors = [
    ['0000000000000000', '0000000000000000', '4ef997456198dd78'],
    ['ffffffffffffffff', 'ffffffffffffffff', '51866fd5b85ecb8a'],
    ['3000000000000000', '1000000000000001', '7d856f9a613063f2'],
    ['1111111111111111', '1111111111111111', '2466dd878b963c9d'],
    ['0123456789abcdef', '1111111111111111', '61f9c3802281b096'],
    ['fedcba9876543210', '0123456789abcdef', '0aceab0fc6a0a28d'],
  ];
  for (const [key, plain, cipher] of vectors) {
    it(`encrypts ${plain} under ${key}`, () => {
      const block = new Uint32Array([parseInt(plain.slice(0, 8), 16), parseInt(plain.slice(8), 16)]);
      Blowfish.withKey(hexBytes(key)).encryptBlock(block, 0);
      const out = Array.from(block, (word) => word.toString(16).padStart(8, '0')).join('');
      expect(out).toBe(cipher);
    });
  }
});

describe('bcrypt_pbkdf', () => {
  it('derives the key ssh-keygen used to encrypt its own key', { timeout: 60_000 }, async () => {
    const path = join(workDir, 'native_encrypted');
    const passphrase = 'known answer';
    keygen('-q', '-t', 'ed25519', '-a', '8', '-N', passphrase, '-f', path);
    const pem = readFileSync(path, 'utf8').split('\n').filter((line) => line && !line.startsWith('-----')).join('');
    const reader = new SshReader(base64Decode(pem));
    expect(new TextDecoder().decode(reader.raw(15))).toBe('openssh-key-v1\0');
    expect(reader.text()).toBe('aes256-ctr');
    expect(reader.text()).toBe('bcrypt');
    const options = new SshReader(reader.string());
    const salt = options.string();
    const rounds = options.uint32();
    expect(rounds).toBe(8);
    expect(reader.uint32()).toBe(1);
    reader.string();
    const encrypted = reader.string();

    const derived = await bcryptPbkdf(utf8(passphrase), salt, 48, rounds);
    const subtle = globalThis.crypto.subtle;
    const aesKey = await subtle.importKey('raw', derived.slice(0, 32), { name: 'AES-CTR' }, false, ['decrypt']);
    const plain = new Uint8Array(
      await subtle.decrypt({ name: 'AES-CTR', counter: derived.slice(32), length: 128 }, aesKey, encrypted.slice()),
    );
    const section = new SshReader(plain);
    expect(section.uint32()).toBe(section.uint32());
    expect(section.text()).toBe('ssh-ed25519');
  });

  const vectors: Array<[string, Uint8Array, number, number, string]> = [
    ['password', utf8('salt'), 4, 32, '5bbf0cc293587f1c3635555c27796598d47e579071bf427e9d8fbe842aba34d9'],
    [
      'password',
      utf8('salt'),
      4,
      48,
      '5ba4bfc60c7ac272931458407f4c1c4936ea356c55125c5a279b791d65bf9842d49d7e1b572a9052715ebfa9421e7e94',
    ],
    [
      'p\u00e4ssw\u00f6rd',
      Uint8Array.from({ length: 16 }, (_, i) => i),
      16,
      48,
      'edade462117fda670e45a2a591a04a3235f4209761d39212700493397b92f2a3a0120b1292244397da48c4013fd1d3d2',
    ],
  ];
  for (const [password, salt, rounds, length, expected] of vectors) {
    it(`matches the reference output for ${rounds} rounds and ${length} bytes`, async () => {
      const key = await bcryptPbkdf(utf8(password), salt, length, rounds);
      expect(Buffer.from(key).toString('hex')).toBe(expected);
    });
  }
});
