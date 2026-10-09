const FIELD_BASE = 8;
const FIELD_HEIGHT = FIELD_BASE + 1;
const FIELD_WIDTH = FIELD_BASE * 2 + 1;
const AUGMENTATION = ' .o+=*BOX@%&#/^SE';

function frame(label: string): string {
  const left = Math.floor((FIELD_WIDTH - label.length) / 2);
  return `+${'-'.repeat(left)}${label}${'-'.repeat(FIELD_WIDTH - left - label.length)}+`;
}

function titleLabel(keyLabel: string, bits: number): string {
  const full = `[${keyLabel} ${bits}]`;
  if (full.length > FIELD_WIDTH) return `[${keyLabel}]`.slice(0, FIELD_WIDTH - 1);
  return full.slice(0, FIELD_WIDTH - 1);
}

/**
 * The "drunken bishop" visual key art, matching ssh-keygen's sshkey_fingerprint_randomart.
 * `keyLabel` is the uppercase key type (`ED25519`, `RSA`, `ECDSA`), `digest` the raw fingerprint hash.
 */
export function randomart(keyLabel: string, bits: number, digest: Uint8Array, hashName = 'SHA256'): string {
  const maxSymbol = AUGMENTATION.length - 1;
  const field = Array.from({ length: FIELD_WIDTH }, () => new Array<number>(FIELD_HEIGHT).fill(0));
  let x = Math.floor(FIELD_WIDTH / 2);
  let y = Math.floor(FIELD_HEIGHT / 2);

  for (const byte of digest) {
    let input = byte;
    for (let step = 0; step < 4; step++) {
      x += input & 0x1 ? 1 : -1;
      y += input & 0x2 ? 1 : -1;
      x = Math.min(Math.max(x, 0), FIELD_WIDTH - 1);
      y = Math.min(Math.max(y, 0), FIELD_HEIGHT - 1);
      if (field[x][y] < maxSymbol - 2) field[x][y]++;
      input >>= 2;
    }
  }
  field[Math.floor(FIELD_WIDTH / 2)][Math.floor(FIELD_HEIGHT / 2)] = maxSymbol - 1;
  field[x][y] = maxSymbol;

  const lines = [frame(titleLabel(keyLabel, bits))];
  for (let row = 0; row < FIELD_HEIGHT; row++) {
    let line = '|';
    for (let column = 0; column < FIELD_WIDTH; column++) {
      line += AUGMENTATION[Math.min(field[column][row], maxSymbol)];
    }
    lines.push(`${line}|`);
  }
  lines.push(frame(`[${hashName}]`.slice(0, FIELD_WIDTH - 1)));
  return lines.join('\n');
}
