<script lang="ts">
  import { fingerprintOf } from '../lib/ssh';
  import CopyButton from './CopyButton.svelte';

  interface Props {
    headingLevel?: 2 | 3;
  }

  let { headingLevel = 2 }: Props = $props();

  let input = $state('');
  let fingerprint = $state('');
  let comment = $state('');
  let error = $state('');
  let busy = $state(false);

  async function check(event: SubmitEvent) {
    event.preventDefault();
    fingerprint = '';
    comment = '';
    error = '';
    const line = input.trim();
    if (!line) {
      error = 'Paste a public key first. It is the contents of the .pub file, for example id_ed25519.pub.';
      return;
    }
    if (/PRIVATE KEY/.test(line)) {
      error = 'This is a private key. Paste the public key (the .pub file) instead, and never share the private one.';
      return;
    }
    busy = true;
    try {
      fingerprint = await fingerprintOf(line);
      comment = line.split(/\s+/).slice(2).join(' ');
    } catch {
      error =
        "That doesn't look like an SSH public key. It should be one line that starts with ssh-ed25519, ssh-rsa or ecdsa-. Check that nothing is missing from the start or the end.";
    } finally {
      busy = false;
    }
  }
</script>

<section class="check" aria-labelledby="check-title">
  <svelte:element this={`h${headingLevel}`} id="check-title">Check a public key's fingerprint</svelte:element>
  <form class="kg" onsubmit={check} novalidate>
    <div class="field">
      <label class="label" for="check-input">Paste a public key (starts with ssh-ed25519, ssh-rsa or ecdsa-)</label>
      <textarea
        id="check-input"
        class="input textarea"
        rows="3"
        bind:value={input}
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        placeholder="ssh-ed25519 AAAAC3Nza... you@example.com"
        aria-describedby={error ? 'check-error' : undefined}
        aria-invalid={error ? 'true' : undefined}
      ></textarea>
    </div>
    <div class="submit">
      <button class="btn btn-quiet" type="submit" disabled={busy}>Show fingerprint</button>
    </div>
  </form>
  <div aria-live="polite">
    {#if fingerprint}
      <div class="fp-result">
        <p class="label">SHA256 fingerprint</p>
        <p class="mono wrap-any">{fingerprint}</p>
        {#if comment}<p class="hint">Comment: {comment}</p>{/if}
        <div class="actions">
          <CopyButton text={fingerprint} label="Copy fingerprint" small />
        </div>
      </div>
    {/if}
    {#if error}
      <p class="field-error" id="check-error">{error}</p>
    {/if}
  </div>
</section>
