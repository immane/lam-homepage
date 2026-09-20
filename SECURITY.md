# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| Latest commit on `main` | Yes |
| Earlier commits and branches | No |

Please reproduce an issue against the latest `main` branch before reporting it.

## Reporting a Vulnerability

Do not open a public issue for a suspected security vulnerability.

Use GitHub's private vulnerability reporting for this repository when it is
available. If private reporting is unavailable, contact the repository owner
through their GitHub profile: [@immane](https://github.com/immane).

Include the following information in your report:

- A clear description of the issue and its potential impact.
- Affected URL, component, commit SHA, or release version.
- Reproduction steps or a minimal proof of concept.
- Any suggested mitigation, if known.
- Your preferred credit name, if you would like to be acknowledged.

Please avoid accessing, modifying, or deleting data that does not belong to
you. Do not disclose the issue publicly until a fix is available and a
coordinated disclosure date is agreed.

## Response Process

The maintainer will aim to:

- Acknowledge a valid report within 7 days.
- Provide a status update within 14 days.
- Prioritize remediation according to impact, exploitability, and affected
  users.
- Publish a fix and security advisory when a coordinated disclosure is needed.

Response and remediation timeframes are targets, not guarantees.

## Scope

This policy covers the code and deployment configuration in this repository,
including the Next.js application, API routes, service worker, browser-based
Linux simulator, and bundled workspace packages.

Third-party services and dependencies are in scope only when the repository's
integration or configuration causes the vulnerability. Please report issues in
third-party projects to their respective maintainers as well.

## Security Notes

- Never commit credentials, tokens, private keys, or production environment
  files.
- Restrict `GITHUB_TOKEN` to the least privilege required for the deployment.
- Keep deployment environment variables private and rotate credentials if they
  are suspected to have been exposed.
