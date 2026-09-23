# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in scrapr (such as remote code execution, prototype pollution, unsafe deserialization, or SSRF in network handlers):

1. **Do not create a public GitHub issue.**
2. Report the vulnerability privately via GitHub Security Advisories tab under `Security` > `Advisories` > `Report a vulnerability`.
3. If GitHub Advisories is unavailable, contact the maintainer directly.

### What to Include

- Detailed description of the issue.
- Step-by-step reproduction code or minimal proof-of-concept.
- Potential impact and affected platforms/methods.

### Scope Note

Upstream third-party web resolvers changing their HTML or breaking their endpoints is considered a functional bug, not a security vulnerability. Please report broken scrapers through public issues.
