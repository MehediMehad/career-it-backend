---
name: backend-code-review
description: Perform production-grade backend code reviews focusing on architecture, Prisma queries, security, authentication, error handling, and performance.
---

# Backend Code Review Skill

## Purpose

Perform comprehensive code reviews on Node.js/Express/Prisma backend features as a Staff Backend Engineer.

---

## 1. Review Categories

### A. Correctness & Business Logic

- Unhandled asynchronous operations or unawaited promises.
- Incomplete or broken edge cases in database queries.
- Race conditions in balance or enrollment updates (missing DB transactions).
- Inconsistent HTTP status codes.

### B. Security & Authentication

- Missing `auth()` or role checks on sensitive mutation routes (`POST`, `PATCH`, `DELETE`).
- IDOR (Insecure Direct Object References) — ensuring users can only edit their own records unless Admin.
- SQL/NoSQL Injection — ensure raw SQL is not used without parameterization.
- Unhashed passwords or sensitive credentials leaked in API responses.
- Missing rate limiting on sensitive public endpoints.

### C. Prisma & Database Performance

- N+1 query patterns inside loops (flag and recommend `findMany` with `in` or `include`).
- Unindexed search or foreign key columns in `prisma/schema/*.prisma`.
- Missing pagination on endpoints that return list records.
- Unnecessary full table scans.

### D. Architectural Conformance

- Adherence to module structure under `src/app/modules/<module_name>/`.
- Separation of concerns: no direct Prisma calls in controllers; controllers use `catchAsync` and `sendResponse`.
- Request validation done via Zod in routes before controllers run.

---

## 2. Severity Classification

Categorize findings:

- **CRITICAL**: Security vulnerability, auth bypass, data loss, unhandled rejection that crashes the server.
- **HIGH**: Functional bug, missing transaction during balance/status changes, N+1 query choking DB.
- **MEDIUM**: Missing input validation, unindexed foreign key, inconsistent error format.
- **LOW**: Naming inconsistency, unused import, minor typing improvements.

---

## 3. Output Format

```text
Summary

CRITICAL
- Issue
- Impact
- Recommendation

HIGH
- Issue
- Impact
- Recommendation

MEDIUM
...

Positive Findings
- ...

Recommended Next Steps
1. ...
2. ...
```
