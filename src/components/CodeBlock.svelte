<script lang="ts">
  import CopyButton from './CopyButton.svelte';

  interface Props {
    code: string;
    label?: string;
    wrap?: boolean;
    copyLabel?: string;
  }

  let { code, label, wrap = false, copyLabel = 'Copy' }: Props = $props();
</script>

<div class="codeblock">
  <div class="codeblock-head">
    <span class="codeblock-label">{label ?? ''}</span>
    <CopyButton text={code} label={copyLabel} ariaLabel={label ? `Copy ${label} command` : 'Copy command'} small />
  </div>
  <pre class="keybox" class:wrap tabindex="0" aria-label={label ? `${label} command` : 'Command'}><code>{code}</code></pre>
</div>
