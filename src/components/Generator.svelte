<script lang="ts">
  import { DEFAULT_BITS, DEFAULT_ROUNDS, ECDSA_BITS, RSA_BITS, isSupported } from '../lib/ssh';
  import type { KeyPair, KeyType } from '../lib/ssh';
  import { termphinUrl } from '../data/site';
  import { generateInBackground } from './keygen';
  import CopyButton from './CopyButton.svelte';
  import FingerprintCheck from './FingerprintCheck.svelte';
  import NextSteps from './NextSteps.svelte';

  const TYPES: { id: KeyType; name: string; description: string }[] = [
    {
      id: 'ed25519',
      name: 'Ed25519',
      description: 'Modern, short and fast. Works with GitHub, GitLab and any server from the last ten years.',
    },
    { id: 'rsa', name: 'RSA', description: "For old servers and devices that don't support Ed25519." },
    { id: 'ecdsa', name: 'ECDSA', description: 'Only if a policy requires NIST curves.' },
  ];
  const NAMES: Record<KeyType, string> = { ed25519: 'Ed25519', rsa: 'RSA', ecdsa: 'ECDSA' };
  const SIZES: Record<KeyType, number[]> = {
    ed25519: [],
    rsa: [...RSA_BITS],
    ecdsa: [...ECDSA_BITS],
  };
  const SIZE_HINTS: Record<KeyType, string> = {
    ed25519: '',
    rsa: '4096 is the safe default. Larger keys take a few seconds to create.',
    ecdsa: '256 is the usual choice. Pick 384 or 521 only if a policy asks for it.',
  };
  const COMMON_PASSWORDS = /password|passw0rd|123456|qwerty|letmein|admin|welcome|iloveyou|abc123|111111/i;

  let ready = $state(false);
  let supported = $state(true);
  let type = $state<KeyType>('ed25519');
  let sizes = $state<Record<KeyType, number>>({ ...DEFAULT_BITS });
  let comment = $state('');
  let passphrase = $state('');
  let confirmation = $state('');
  let showPassphrase = $state(false);
  let busy = $state(false);
  let busyNote = $state('');
  let error = $state('');
  let status = $state('');
  let pair = $state<KeyPair | null>(null);
  let showPrivate = $state(false);
  let output = $state<HTMLElement | null>(null);
  let submitButton = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    supported = isSupported();
    ready = true;
  });

  const mismatch = $derived(confirmation.length > 0 && passphrase !== confirmation);
  const strength = $derived(rate(passphrase));

  function rate(value: string): { level: number; label: string; tip: string } {
    if (!value) return { level: 0, label: '', tip: '' };
    let pool = 0;
    if (/[a-z]/.test(value)) pool += 26;
    if (/[A-Z]/.test(value)) pool += 26;
    if (/[0-9]/.test(value)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(value)) pool += 33;
    let entropy = value.length * Math.log2(Math.max(pool, 2));
    if (/^(.)\1*$/.test(value) || COMMON_PASSWORDS.test(value)) entropy = Math.min(entropy, 20);
    if (entropy < 40) return { level: 1, label: 'weak', tip: 'try four or more random words.' };
    if (entropy < 60) return { level: 2, label: 'fair', tip: 'one or two more words make it strong.' };
    if (entropy < 80) return { level: 3, label: 'good', tip: 'keep it in a password manager.' };
    return { level: 4, label: 'strong', tip: 'keep it in a password manager.' };
  }

  async function generate(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    error = '';
    if (passphrase !== confirmation) {
      error =
        confirmation.length === 0
          ? 'Type the passphrase again in "Repeat passphrase".'
          : "The two passphrases don't match. Type them again.";
      return;
    }
    busy = true;
    showPrivate = false;
    const notes: string[] = [];
    if (type === 'rsa') notes.push(`RSA ${sizes.rsa} keys can take a few seconds to create.`);
    if (passphrase) notes.push('Encrypting with your passphrase takes a second or two.');
    busyNote = notes.join(' ');
    status = `Generating your ${NAMES[type]} key. ${busyNote}`.trim();
    try {
      const result = await generateInBackground({
        type,
        rounds: DEFAULT_ROUNDS,
        bits: type === 'ed25519' ? undefined : sizes[type],
        comment: comment.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim(),
        passphrase,
      });
      pair = result;
      status = `Your ${NAMES[result.type]} key is ready${result.encrypted ? ' and encrypted with your passphrase' : ''}.`;
      requestAnimationFrame(() => output?.focus());
    } catch (reason) {
      const detail = reason instanceof Error && reason.message ? ` (${reason.message})` : '';
      error = `Something went wrong while creating the key${detail}. Please try again.`;
      status = '';
    } finally {
      busy = false;
      busyNote = '';
    }
  }

  function download(name: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function startOver() {
    pair = null;
    showPrivate = false;
    passphrase = '';
    confirmation = '';
    error = '';
    status = 'The keys were removed from this page. You can create a new one.';
    requestAnimationFrame(() => submitButton?.focus());
  }
</script>

<div class="tool">
  {#if !supported}
    <div class="notice" role="alert">
      <p class="field-error">This browser can't create keys: it has no Web Crypto API.</p>
      <p class="hint">Update the browser or open the page over HTTPS. You can also follow a <a href="/#guides">guide for your computer</a>.</p>
    </div>
  {:else}
    <form class="kg" onsubmit={generate} novalidate aria-label="Create an SSH key">
      <fieldset class="field">
        <legend class="label">Key type</legend>
        <div class="choices">
          {#each TYPES as item (item.id)}
            <label class="choice">
              <input type="radio" name="kg-type" value={item.id} bind:group={type} />
              <span class="choice-body">
                <span class="choice-name">
                  {item.name}
                  {#if item.id === 'ed25519'}<span class="tag">Recommended</span>{/if}
                </span>
                <span class="choice-desc">{item.description}</span>
              </span>
            </label>
          {/each}
        </div>
      </fieldset>

      {#if type !== 'ed25519'}
        <fieldset class="field" aria-describedby="kg-size-hint">
          <legend class="label">Key size</legend>
          <div class="sizes">
            {#each SIZES[type] as size (size)}
              <label class="size">
                <input type="radio" name={`kg-size-${type}`} value={size} bind:group={sizes[type]} />
                <span>{size} bits</span>
              </label>
            {/each}
          </div>
          <p class="hint" id="kg-size-hint">{SIZE_HINTS[type]}</p>
        </fieldset>
      {/if}

      <div class="field">
        <label class="label" for="kg-comment">Comment <span class="opt">(optional)</span></label>
        <p class="hint" id="kg-comment-hint">A label to recognise the key later, usually your email or user@computer.</p>
        <input
          id="kg-comment"
          class="input"
          type="text"
          bind:value={comment}
          placeholder="you@example.com"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="200"
          aria-describedby="kg-comment-hint"
        />
      </div>

      <div class="field">
        <label class="label" for="kg-pass">Passphrase <span class="opt">(optional, recommended)</span></label>
        <p class="hint" id="kg-pass-hint">Encrypts the private key file. If someone copies the file, they still can't use it without this.</p>
        <div class="input-row">
          <input
            id="kg-pass"
            class="input"
            type={showPassphrase ? 'text' : 'password'}
            bind:value={passphrase}
            autocomplete="new-password"
            autocapitalize="off"
            spellcheck="false"
            aria-describedby={passphrase ? 'kg-pass-hint kg-pass-strength' : 'kg-pass-hint'}
          />
          <button
            type="button"
            class="btn-2"
            onclick={() => (showPassphrase = !showPassphrase)}
            aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
            aria-controls="kg-pass"
          >
            {showPassphrase ? 'Hide' : 'Show'}
          </button>
        </div>
        {#if passphrase}
          <p class="hint" id="kg-pass-strength">
            Strength: <span class="strength" data-level={strength.level}>{strength.label}</span> - {strength.tip}
          </p>
        {/if}
      </div>

      {#if passphrase}
        <div class="field">
          <label class="label" for="kg-confirm">Repeat passphrase</label>
          <input
            id="kg-confirm"
            class="input"
            type={showPassphrase ? 'text' : 'password'}
            bind:value={confirmation}
            autocomplete="new-password"
            autocapitalize="off"
            spellcheck="false"
            aria-invalid={mismatch ? 'true' : undefined}
            aria-describedby={mismatch ? 'kg-confirm-error' : undefined}
          />
          {#if mismatch}
            <p class="field-error" id="kg-confirm-error">The passphrases don't match yet.</p>
          {/if}
        </div>
      {/if}

      <div class="submit">
        <button class="btn" type="submit" bind:this={submitButton} disabled={!ready || busy} aria-busy={busy}>
          {busy ? 'Generating...' : 'Generate SSH key'}
        </button>
        {#if busy && busyNote}
          <p class="hint">{busyNote}</p>
        {/if}
        {#if error}
          <p class="field-error" role="alert">{error}</p>
        {/if}
        <p class="hint">Your keys are created in this browser tab and never sent anywhere.</p>
      </div>
    </form>

    {#if pair && !busy}
      <section class="result" bind:this={output} tabindex="-1" aria-labelledby="kg-result-title">
        <h2 id="kg-result-title">Your new SSH key</h2>
        <p class="result-lead">A key is two files: the public key you share, and the private key you keep secret.</p>
        <p class="hint">The keys disappear when you close or reload this tab, so save them first.</p>

        <div class="keyfile">
          <h3>Public key <span class="fname">{pair.fileName}.pub</span></h3>
          <p class="hint">Paste this into GitHub, GitLab or a server's ~/.ssh/authorized_keys. Safe to share.</p>
          <pre class="keybox wrap" tabindex="0" aria-label="Public key">{pair.publicKey.trimEnd()}</pre>
          <div class="actions">
            <CopyButton text={pair.publicKey} label="Copy public key" />
            <button type="button" class="btn-2" onclick={() => pair && download(`${pair.fileName}.pub`, pair.publicKey)}>
              Download {pair.fileName}.pub
            </button>
          </div>
        </div>

        <div class="keyfile secret">
          <h3>Private key <span class="fname">{pair.fileName}</span></h3>
          <p class="secret-note">Keep this secret. Anyone with this file can log in as you. Save it to ~/.ssh/ on your computer.</p>
          <p class="key-status" data-encrypted={pair.encrypted}>
            {#if pair.encrypted}
              Encrypted with your passphrase.
            {:else}
              Not encrypted. Anyone who gets a copy of the file can use it.
            {/if}
          </p>
          <div class="actions">
            <button type="button" class="btn-2" onclick={() => pair && download(pair.fileName, pair.privateKey)}>
              Download {pair.fileName}
            </button>
            <CopyButton text={pair.privateKey} label="Copy" ariaLabel="Copy private key" />
            <button
              type="button"
              class="btn-2"
              onclick={() => (showPrivate = !showPrivate)}
              aria-expanded={showPrivate}
              aria-controls="kg-private"
              aria-label={showPrivate ? 'Hide private key' : 'Show private key'}
            >
              {showPrivate ? 'Hide' : 'Show'}
            </button>
          </div>
          <pre class="keybox wrap" id="kg-private" tabindex="0" aria-label="Private key" hidden={!showPrivate}>{pair.privateKey.trimEnd()}</pre>
        </div>

        <details class="details">
          <summary>Details</summary>
          <dl class="facts-list">
            <dt>Key type</dt>
            <dd>{NAMES[pair.type]}, {pair.bits} bits</dd>
            <dt>Fingerprint</dt>
            <dd>
              <span class="mono wrap-any">{pair.fingerprint}</span>
              <span class="hint block-hint">Used to identify the key, e.g. in GitHub's key list.</span>
            </dd>
            <dt>Randomart</dt>
            <dd>
              <pre class="art" aria-label="Randomart image of the key">{pair.randomart}</pre>
              <span class="hint block-hint">A picture of the fingerprint, easier to compare by eye.</span>
            </dd>
          </dl>
        </details>

        <div class="actions">
          <button type="button" class="btn-2" onclick={startOver}>Start over</button>
        </div>
      </section>

      <NextSteps fileName={pair.fileName} />

      <section class="tp-block tp-results" aria-labelledby="kg-termphin-title">
        <h2 id="kg-termphin-title">Connect with this key</h2>
        <p>
          Import {pair.fileName} into Termphin - it reads OpenSSH keys, including ones encrypted with a passphrase - and keep
          it in its encrypted key vault.
        </p>
        <p class="tp-actions"><a class="tp-btn" href={termphinUrl('generator-results')} rel="noopener">Get Termphin</a></p>
      </section>
    {/if}

    <p class="sr-only" role="status">{status}</p>

    <FingerprintCheck />
  {/if}
</div>
