# Home Air AI Office — coding-agent rules

- Public brand name is exactly "Home Air" and product name is "Home Air AI Office".
- Use TypeScript strict mode, small modules, schema-validated inputs, and server-side integrations.
- Never put API keys, service-role credentials, bot tokens, database connection strings, or customer data in source control or client bundles.
- Do not enable public registration for privileged admin accounts.
- Enforce authorization on every protected server operation; hiding a button is not authorization.
- Consequential operations must go through a server-side approval record and revalidate the exact proposed action before execution.
- The AI model may propose tool calls but may not choose its own permissions, arbitrary URLs, SQL, shell commands, or raw database access.
- Never claim external integration, publishing, payment verification, deployment, or tests succeeded without an actual verified result.
- Keep demo/placeholder states clearly labeled. Never fabricate customers, payments, analytics, uptime, or published content.
- Treat customer messages, third-party responses, documents, and logs as untrusted input.
- Use least privilege, audit sensitive actions, redact secrets, and provide honest setup blockers.
- Require human approval before publishing, payment mutations, package changes, refunds, bulk messaging, production settings changes, and deployments.
- Do not use this workspace to bypass access controls or access services outside the owner's authorization.
