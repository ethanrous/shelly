---
name: "diagnose-corporate-python-tls"
description: "Separate corporate CA discovery failures from strict certificate-validation failures and evaluate environment-level Python fixes."
version: 1
created: "2026-09-17"
updated: "2026-09-17"
---
## When to Use
Research Python HTTPS failures behind corporate TLS inspection, particularly when browsers work or per-client truststore patches are proposed.

## Procedure
1. Read the failing client's code and pinned Python/HTTP-library versions; distinguish runtime configuration from package-manager TLS settings.
2. Separate missing issuer/trust-anchor errors from strict X.509 errors such as non-critical CA basicConstraints. A CA bundle fixes trust discovery, not malformed certificate extensions.
3. Check Python ssl documentation, urllib3 release notes, truststore guidance, and the interception vendor's current certificate updates. Prefer IT deployment of a compliant chain plus appropriate runtime trust configuration.
4. When global truststore injection is blamed for botocore failures, run fresh, network-free subprocesses comparing injection before versus after importing botocore.httpsession, then call create_urllib3_context. Report context construction separately from live TLS success.
5. Evaluate environment-startup packages such as pip-system-certs as candidates, noting per-venv installation, global injection, dependency requirements, and the need to test actual startup and HTTP clients.
6. If a vendor documentation page is a JavaScript shell, try a readable rendering through https://r.jina.ai/https://... and verify exact passages rather than relying solely on search summaries.

## Pitfalls
- Do not assume every Zscaler certificate is malformed, or infer the failing chain element solely from the error text.
- System truststore uses native verification on macOS/Windows but OpenSSL on Linux; results are not interchangeable.
- Late injection recursion does not establish that early injection or pip-system-certs is incompatible.
- Configuring pip or uv to use system trust does not automatically configure applications they install or run.
- Do not recommend verify=False, disabling strict validation globally, editing certifi in place, or dependency downgrades as durable fixes.

## Verification
1. Cite primary sources for version changes and vendor remediation.
2. Confirm no repository or environment mutation during research unless requested.
3. Before deploying a startup fix, test requests/httpx/botocore, real relevant TLS handshakes without unnecessary API calls, and rejection of invalid certificates.