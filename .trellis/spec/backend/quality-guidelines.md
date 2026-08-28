# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

The production web server is started through `node custom-server.js`. The wrapper
must preserve platform-provided runtime values and supply local defaults before
loading the Next standalone server. Keep deployment contracts environment-driven
because the same image is used by local Docker and managed platforms.

---

## Deployment Contract

## Scenario: Container web-server port contract

### 1. Scope / Trigger

- Trigger: Docker/Koyeb deployment and environment wiring.
- Scope: `custom-server.js`, Docker runtime metadata, `npm start`, and the
  unauthenticated health route.

### 2. Signatures

- Command: `node custom-server.js`
- npm command: `npm start` -> `node custom-server.js`
- Health API: `GET /api/health`

### 3. Contracts

- `PORT`: optional positive decimal string. Preserve the platform-provided value;
  use `20128` when absent. On Koyeb, when exactly one
  `KOYEB_PORT_<PORT>_PROTOCOL` variable exists, that exposed port is authoritative
  and repairs a stale `PORT` value.
- `HOSTNAME`: optional bind hostname. Use `0.0.0.0` when absent so a container
  can receive traffic from outside its network namespace.
- `GET /api/health`: returns HTTP `200`, JSON `{ "ok": true }`, and does not
  require authentication or an upstream provider.
- Docker default: `EXPOSE 20128`, `ENV PORT=20128`, and
  `CMD ["node", "custom-server.js"]`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `PORT` absent | Bind to `20128`. |
| `PORT=8000` from Koyeb | Bind to `8000`; Koyeb must expose `8000`. |
| One `KOYEB_PORT_8000_PROTOCOL` exists and `PORT=20128` is stale | Set `PORT` to `8000` before starting Next. |
| `PORT=20128` | Bind to `20128`; Koyeb must expose `20128`. |
| Exposed port differs from `PORT` | Deployment TCP/HTTP health check fails; correct the service config. |
| `GET /api/health` | Return `200` and `{ "ok": true }`. |

### 5. Good/Base/Bad Cases

- Good: Koyeb exposes `8000`, has `PORT=8000`, and health-checks
  `/api/health`.
- Base: Local Docker uses the image default `20128` and maps
  `20128:20128`.
- Bad: Koyeb exposes `8000` while a manually configured `PORT=20128` remains.

### 6. Tests Required

- Unit regression: assert `applyRuntimeDefaults({}).PORT === "20128"` and
  `applyRuntimeDefaults({ PORT: "8000" }).PORT === "8000"`.
- Contract regression: assert npm/Docker metadata and `/api/health` are aligned.
- Production smoke check: start the standalone server with `PORT=8000` and
  verify `GET /api/health` returns HTTP `200`; repeat without `PORT` on `20128`.

### 7. Wrong vs Correct

#### Wrong

```json
{ "start": "node custom-server.js --port 20127" }
```

with Koyeb forwarding to `8000` and/or Docker declaring `20128`.

#### Correct

```json
{ "start": "node custom-server.js" }
```

The wrapper preserves `PORT=8000` on Koyeb, repairs a stale value when one Koyeb
port marker exists, and defaults to `20128` for local Docker.

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

Do not hardcode a production port in the npm start command or in code that runs
after the platform has supplied `PORT`. Do not configure a Koyeb exposed port
that differs from the value visible to the process.

## Required Patterns

<!-- Patterns that must always be used -->

Use the environment-driven `node custom-server.js` entrypoint and retain the
`20128` fallback for local Docker compatibility.

---

## Testing Requirements

<!-- What level of testing is expected -->

Before committing deployment changes:

- Run the focused deployment and custom-server tests.
- Run ESLint on changed JavaScript files.
- Run `npm run build` to verify standalone output is still generated.
- Run a production smoke request against `/api/health` for both the Koyeb-style
  explicit port and the local fallback.

---

## Code Review Checklist

<!-- What reviewers should check -->

Reviewers should check that the command, Docker `EXPOSE`, runtime `PORT`, service
exposed port, and health-check route describe one coherent contract. Any full
suite failures unrelated to deployment must be reported separately rather than
being hidden by snapshot updates.
