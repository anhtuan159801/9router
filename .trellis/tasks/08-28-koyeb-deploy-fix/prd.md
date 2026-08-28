# Fix Koyeb deployment startup and health checks

## Goal

Make the Docker deployment start reliably on Koyeb while preserving the existing
Docker and local runtime contract. The public Koyeb service must reach the Next.js
application and pass its startup health check after a fresh image build.

## Confirmed facts

- Koyeb build `27326785` completed successfully, so the failure is after image
  build during container startup or health checking.
- The Koyeb service currently forwards traffic to container port `8000` and has
  zero running instances.
- `Dockerfile` currently sets `PORT=20128`, exposes `20128`, and starts
  `node custom-server.js`.
- `custom-server.js` ultimately starts the Next standalone server, which reads
  `process.env.PORT` and binds to `HOSTNAME`.
- The application has a lightweight `GET /api/health` route returning
  `{ "ok": true }`.
- `package.json` has a separate `start` script hardcoded to `--port 20127`,
  which is inconsistent with both the Docker image (`20128`) and Koyeb's
  configured port (`8000`). The Docker image does not currently use this script.
- Koyeb documents that Web Services always define `PORT`; when not explicitly
  set, it is derived from the lowest exposed port. The configured exposed port
  and the process listening port must agree.
- Koyeb also exposes `KOYEB_PORT_<PORT>_PROTOCOL` for each configured port, which
  provides a runtime signal for reconciling a stale image/service `PORT` value.

## Requirements

1. Make the container listen on the Koyeb-provided `PORT` when present, use a
   single Koyeb exposed-port variable as the authoritative fallback/reconciliation
   signal, and retain a safe local/Docker fallback of `20128`.
2. Keep the listener bound to `0.0.0.0` by default so Koyeb can reach it.
3. Remove contradictory hardcoded start-port behavior from the npm start path.
4. Keep the existing standalone server wrapper and runtime asset behavior intact.
5. Add a regression check for the deployment contract where practical, without
   introducing a new test framework or requiring Koyeb credentials.
6. Update deployment documentation/configuration enough that a fresh Koyeb
   deployment uses one consistent port and health endpoint.

## Acceptance criteria

- `npm run build` succeeds.
- A production server started with `PORT=8000` binds to `0.0.0.0:8000` and
  `GET /api/health` returns HTTP 200 with `ok: true`.
- A production server started without `PORT` falls back to port `20128`.
- The Dockerfile's declared port, default runtime port, and documented Koyeb
  configuration are no longer contradictory.
- Existing unit tests relevant to `custom-server.js` and the final lint/check
  commands pass, or any pre-existing failures are clearly separated.

## Out of scope

- Changing provider credentials, Supabase setup, application authentication, or
  Koyeb environment secrets.
- Deploying to or modifying the user's Koyeb account directly.
- Reworking unrelated application features.

## Open questions

None block implementation. The source and deployment log provide enough evidence
to implement the port contract and validate it locally.
