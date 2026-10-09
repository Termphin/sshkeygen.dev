<script lang="ts">
  interface Props {
    text: string;
    label?: string;
    ariaLabel?: string;
    small?: boolean;
    describedBy?: string;
  }

  let { text, label = 'Copy', ariaLabel, small = false, describedBy }: Props = $props();
  let copied = $state(false);
  let failed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    failed = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      failed = true;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      copied = false;
      failed = false;
    }, 2000);
  }
</script>

<button
  type="button"
  class="btn-2"
  class:small
  class:done={copied}
  class:bad={failed}
  onclick={copy}
  aria-label={ariaLabel}
  aria-describedby={describedBy}
>
  {copied ? 'Copied' : failed ? 'Copy failed' : label}
</button>
<span class="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : failed ? 'Copy failed, select the text and copy it manually' : ''}</span>
