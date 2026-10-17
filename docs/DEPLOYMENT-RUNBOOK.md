# Deployment runbook — deprecated

> **Do not use this file as an operational runbook.** Its original instructions were written for a different sandbox path (`/home/z/my-project/`) and an unrelated `english-aloeducation/` directory. Those assumptions do not describe the current MarketingOS checkout.

Use [docs/DEPLOYMENT.md](DEPLOYMENT.md) as the current repository-level deployment and persistence reference. It documents the checked-in SQLite Compose reference, backup/schema-sync safeguards, CI/deploy workflow, and the configuration that still must be verified against the live server. The compose file on the VPS is not in this repository, so repository documentation alone is not proof of live configuration.

For product scope, provider behavior, and validation gaps, see [docs/REFERENCE-AND-PROJECT-AUDIT.md](REFERENCE-AND-PROJECT-AUDIT.md). No production deployment is asserted by these documents.
