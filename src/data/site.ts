export const SITE_URL = 'https://sshkeygen.dev';
export const SITE_NAME = 'sshkeygen.dev';
export const GITHUB_URL = 'https://github.com/Termphin/sshkeygen.dev';
export const TERMPHIN_URL = 'https://termphin.dev';
export const CONTACT_EMAIL = 'contact@termphin.dev';
export const OG_IMAGE = '/og-image.png';

export interface GuideLink {
  href: string;
  label: string;
  summary: string;
}

export const guides: GuideLink[] = [
  {
    href: '/generate-ssh-key-mac',
    label: 'Generate an SSH key on macOS',
    summary: 'ssh-keygen in Terminal, the Keychain and ~/.ssh/config.',
  },
  {
    href: '/generate-ssh-key-linux',
    label: 'Generate an SSH key on Linux',
    summary: 'ssh-keygen, ssh-agent and permissions on any distribution.',
  },
  {
    href: '/generate-ssh-key-windows',
    label: 'Generate an SSH key on Windows',
    summary: 'The built-in OpenSSH client, PowerShell and the agent service.',
  },
  {
    href: '/ssh-key-for-github',
    label: 'SSH key for GitHub, GitLab and Bitbucket',
    summary: 'Add a key to your account and test the connection.',
  },
  {
    href: '/add-ssh-key-to-server',
    label: 'Add an SSH key to a server',
    summary: 'authorized_keys, ssh-copy-id, permissions and troubleshooting.',
  },
  {
    href: '/ed25519-vs-rsa',
    label: 'Ed25519 vs RSA vs ECDSA',
    summary: 'Which key type to pick in 2026, and when RSA still matters.',
  },
  {
    href: '/ssh-key-passphrase',
    label: 'SSH key passphrases',
    summary: 'Why to set one, ssh-agent, and changing it with ssh-keygen -p.',
  },
  {
    href: '/ssh-key-fingerprint',
    label: 'SSH key fingerprints',
    summary: 'What a fingerprint is and how to check one.',
  },
  {
    href: '/ssh-keygen',
    label: 'ssh-keygen command reference',
    summary: 'Every common flag, with examples.',
  },
  {
    href: '/ssh-connection-keeps-dropping',
    label: 'SSH connection keeps dropping',
    summary: 'Broken pipe and timeouts: keepalives, tmux, mosh and sessions that survive.',
  },
  {
    href: '/ssh-key-on-phone',
    label: 'Use an SSH key on your phone',
    summary: 'Generate or move a key safely, import it, and revoke a lost phone.',
  },
  {
    href: '/ai-coding-agent-over-ssh',
    label: 'Run Claude Code or Codex over SSH',
    summary: 'A coding agent on a server you check from your phone.',
  },
];

export const TERMPHIN_ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${TERMPHIN_URL}/#organization`,
  name: 'Termphin',
  url: TERMPHIN_URL,
};

export const TERMPHIN_APPLICATION = {
  '@type': 'SoftwareApplication',
  name: 'Termphin',
  applicationCategory: 'DeveloperApplication',
  url: TERMPHIN_URL,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

/** Builds a Termphin link tagged with the referral campaign for one placement on this site. */
export function termphinUrl(placement: string): string {
  const params = new URLSearchParams({
    utm_source: 'sshkeygen.dev',
    utm_medium: 'referral',
    utm_campaign: placement,
  });
  return `${TERMPHIN_URL}/?${params.toString()}`;
}

/** Returns the absolute canonical URL for a site path, without a trailing slash except for the root. */
export function canonicalUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_URL}/`;
  return `${SITE_URL}${path.replace(/\/+$/, '')}`;
}
