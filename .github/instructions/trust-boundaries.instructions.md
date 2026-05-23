---
description: "Use when working on DyKnow scanning, connectors, LLM providers, sync, publishing, audit logging, secrets handling, local-only mode, or any trust and security sensitive behavior."
name: "DyKnow Trust Boundaries"
---

# DyKnow Trust Boundaries

- Preserve DyKnow's scoped-access promise: read only approved sources, write only approved outputs, and keep every change traceable to source material.
- Never weaken the default ignore posture for `.env`, secrets, credentials, raw customer data, private keys, sensitive logs, payment data, or unapproved folders without an explicit product decision.
- High-risk content must require human approval before publish or sync. Do not auto-apply pricing, legal, security, compliance, or customer-commitment changes.
- Local-only mode must fail closed if a remote provider or external sync target is selected.
- Keep public and private content boundaries explicit in config and outputs.
- Connectors for communication tools must stay narrowly scoped, for example specific channels rather than whole workspaces.
- Preserve auditability: record source reads, drafts, approvals, and publish actions in an append-only trail.