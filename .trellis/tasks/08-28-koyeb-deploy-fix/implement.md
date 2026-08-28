# Implementation Plan

1. Read the backend/frontend spec indexes and applicable quality guidance.
2. Normalize the npm production start command to use the environment-provided
   port and the image default, removing the stale `20127` override.
3. Add a focused deployment contract test or script that verifies the start
   configuration and health response behavior without external services.
4. Update `DOCKER.md` (and compose/config examples only where required) with the
   Koyeb port and `/api/health` settings.
5. Run the focused test, lint/check commands available in `package.json`, and
   `npm run build`.
6. Inspect the final diff for unrelated changes and provide the exact Koyeb
   redeploy settings to the user.

## Validation commands

```text
npm run build
npx eslint custom-server.js src/app/api/health/route.js
```

If a test is added, run its direct command from the repository's existing test
runner configuration. Docker/Koyeb validation is performed by checking that the
service exposes the same port as `PORT` and uses `/api/health`.

## Risk and rollback points

- Risk: changing `package.json` start semantics could affect non-Docker users.
  Mitigation: preserve fallback port `20128` and test both explicit and default
  port behavior.
- Risk: Koyeb service configuration may still have a user-defined `PORT=20128`
  while exposing `8000`. Mitigation: document that the exposed port and `PORT`
  must be identical.
- Rollback: revert only the deployment contract changes if the existing release
  needs to be restored.
