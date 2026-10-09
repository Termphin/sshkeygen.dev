<script lang="ts">
  import { onMount } from 'svelte';
  import CodeBlock from './CodeBlock.svelte';

  interface Props {
    fileName: string;
  }

  let { fileName }: Props = $props();

  const tabs = [
    { id: 'mac', label: 'macOS' },
    { id: 'linux', label: 'Linux' },
    { id: 'windows', label: 'Windows' },
  ] as const;
  type TabId = (typeof tabs)[number]['id'];

  let active = $state<TabId>('mac');
  const tabButtons: HTMLButtonElement[] = [];

  onMount(() => {
    const agent = navigator.userAgent;
    if (/Windows/i.test(agent)) active = 'windows';
    else if (/Linux|X11|CrOS/i.test(agent) && !/Android/i.test(agent)) active = 'linux';
  });

  function onKeydown(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    active = tabs[next].id;
    tabButtons[next]?.focus();
  }

  const windows = $derived(active === 'windows');
  const shell = $derived(windows ? 'PowerShell' : 'Terminal');
  const folder = $derived(
    active === 'windows' ? 'C:\\Users\\you\\.ssh' : active === 'mac' ? '/Users/you/.ssh' : '/home/you/.ssh',
  );

  const save = $derived(
    windows
      ? [
          `mkdir -Force "$HOME\\.ssh" > $null`,
          `Move-Item "$HOME\\Downloads\\${fileName}", "$HOME\\Downloads\\${fileName}.pub" "$HOME\\.ssh\\"`,
        ].join('\n')
      : [`mkdir -p ~/.ssh`, `mv ~/Downloads/${fileName} ~/Downloads/${fileName}.pub ~/.ssh/`].join('\n'),
  );

  const protect = $derived(
    windows
      ? `icacls "$HOME\\.ssh\\${fileName}" /inheritance:r /grant:r "$($env:USERNAME):F"`
      : `chmod 600 ~/.ssh/${fileName}`,
  );

  const install = $derived(
    windows
      ? `type "$HOME\\.ssh\\${fileName}.pub" | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"`
      : `ssh-copy-id -i ~/.ssh/${fileName}.pub user@host`,
  );
</script>

<section class="next" aria-labelledby="next-title">
  <div class="next-head">
    <h2 id="next-title">What to do next</h2>
    <div class="switch" role="tablist" aria-label="Your computer's operating system">
      {#each tabs as tab, index (tab.id)}
        <button
          bind:this={tabButtons[index]}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls="next-panel"
          tabindex={active === tab.id ? 0 : -1}
          onclick={() => (active = tab.id)}
          onkeydown={(event) => onKeydown(event, index)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  </div>

  <div role="tabpanel" id="next-panel" aria-labelledby={`tab-${active}`}>
    <ol class="next-steps">
      <li>
        <h3>Save both files in your .ssh folder</h3>
        <p>
          SSH looks for keys in a folder called <code>.ssh</code> in your home folder, on {tabs.find((tab) => tab.id === active)?.label}
          that is <code>{folder}</code>. Your browser saved the files to Downloads; this moves them there.
          {#if active === 'mac'}The folder is hidden in Finder: press Cmd+Shift+G and type <code>~/.ssh</code> to open it.{/if}
        </p>
        <CodeBlock label={shell} code={save} wrap />
      </li>
      <li>
        <h3>Protect the private key</h3>
        <p>SSH refuses a private key that other people on the computer can read. This makes {fileName} readable only by you.</p>
        <CodeBlock label={shell} code={protect} wrap />
      </li>
      <li>
        <h3>Add the public key where you log in</h3>
        <p>
          Open your account's SSH key settings, paste the public key ({fileName}.pub) and save. For your own server, add it
          to the server's list of allowed keys.
        </p>
        <div class="actions">
          <a class="btn-2" href="https://github.com/settings/ssh/new" target="_blank" rel="noopener">Add to GitHub<span class="sr-only"> (opens in a new tab)</span></a>
          <a class="btn-2" href="https://gitlab.com/-/user_settings/ssh_keys" target="_blank" rel="noopener">Add to GitLab<span class="sr-only"> (opens in a new tab)</span></a>
          <a class="btn-2" href="/add-ssh-key-to-server" target="_blank" rel="noopener">Add to a server<span class="sr-only"> (opens in a new tab)</span></a>
        </div>
        <p>On a server you can already reach with a password, this copies the key for you:</p>
        <CodeBlock label={shell} code={install} wrap />
      </li>
      <li>
        <h3>Connect</h3>
        <p>
          Replace <code>user</code> and <code>host</code> with your username and the server's address. SSH picks up
          {fileName} on its own. To test GitHub, run <code>ssh -T git@github.com</code>.
        </p>
        <CodeBlock label={shell} code="ssh user@host" />
      </li>
    </ol>
  </div>
</section>
