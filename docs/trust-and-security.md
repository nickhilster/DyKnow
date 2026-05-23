---
title: Trust and Security
purpose: Define the trust model, security controls, governance, and sensitive-content handling for DyKnow.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 5, 11, 12)
last_reviewed: 2026-05-23
confidence: high
---

## Summary

Trust is the core commercial issue. No serious organization wants to expose private repos, confidential docs, customer data, or strategy to an outside system without strong reason and strong governance. DyKnow is built around a **scoped access** principle: read only approved sources, update only approved outputs, make every change traceable.

> DyKnow says: "Connect only the sources you approve. DyKnow detects relevant changes, drafts source-backed updates, and keeps humans in control."
>
> DyKnow does **not** say: "Give us all your data and we will update your pages."

## Trust principles

1. No full repo access required by default.
2. Scoped connectors only.
3. Human approval before publishing.
4. Source-backed update reasoning.
5. No training on customer data.
6. Audit logs for every update.
7. Role-based access controls.
8. Clear public/private content boundaries.
9. Bring-your-own-LLM option.
10. Local-only mode for sensitive teams.

## Required controls

- Scoped OAuth permissions.
- Local-only mode.
- Bring-your-own-key mode.
- Secret detection.
- Default ignore patterns (`.env`, `secrets/**`, credentials, private keys, prod dumps, sensitive logs, payment data, unapproved folders, build artifacts).
- Audit logs.
- Role-based access.
- Approval workflows.
- Data retention controls.
- Source-level permissions.
- Public/private content labels.
- Redaction tools.
- Export controls.
- No training on customer data.
- Self-hosted option for enterprise.

## Human-in-the-loop governance

The canonical workflow:

1. Detect
2. Draft
3. Explain
4. Review
5. Approve
6. Publish
7. Audit

The system supports automation, but trust comes from reviewability.

### Review states

Drafted, Needs review, Approved, Rejected, Edited, Published, Archived, Escalated.

### Per-update metadata

Every suggested update carries:

- Confidence score
- Impacted pages
- Source evidence
- Risk level
- Public/private sensitivity
- Suggested reviewer

## High-risk content

High-risk changes **never publish automatically**. They include:

- Pricing
- Legal language
- Compliance claims
- Security statements
- Medical claims
- Financial claims
- Customer data handling
- Enterprise commitments

## Sensitive content detection

DyKnow warns when proposed output may include:

- Secrets
- Access tokens
- Credentials
- Personal information
- Customer data
- Confidential roadmap information
- Legal claims
- Security claims
- Pricing commitments
- Unapproved internal terms

## Default posture

DyKnow defaults to caution. The product is trusted because it is not reckless.

## Cross-references

- [Architecture](architecture.md) — where the audit and governance layer lives.
- [Feature Map](feature-map.md) — what's scanned and what's ignored.
- [Setup Guide](setup-guide.md) — the `allowedSources` / `ignoredSources` config.

## Open questions

- Specific certifications targeted for Enterprise tier (SOC 2 Type II, ISO 27001, etc.).
- Default retention windows for audit logs.
