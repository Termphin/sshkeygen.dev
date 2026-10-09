# Security policy

sshkeygen.dev generates private keys, so we take reports seriously.

## Reporting a vulnerability

Email **contact@termphin.dev** with a description of the issue, the steps to reproduce it and, if you can, a proof of concept. Please do not open a public GitHub issue for security problems.

We acknowledge reports within a few working days, keep you informed while we fix the issue, and credit you in the release notes unless you prefer otherwise.

## In scope

- Anything that could make a generated key weak, predictable or incompatible with OpenSSH in a way that reduces its security
- Anything that could send a key, passphrase or pasted public key off the device
- Bypasses of the Content Security Policy, injection or cross-site scripting on the site
- Supply-chain issues in the dependencies we ship to the browser

## Out of scope

- Attacks that require a compromised device, browser or browser extension
- Missing HTTP headers on third-party mirrors of the site
- Denial of service against the static hosting

## Supported versions

Only the version deployed at https://sshkeygen.dev and the `main` branch are supported.
