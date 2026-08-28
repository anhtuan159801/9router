# Technical Design

## Scope and boundary

The fix is limited to the container entrypoint/runtime contract, the npm start
contract, deployment documentation, and a focused regression test if the current
test setup supports it. Application request handlers and provider behavior remain
unchanged.

## Runtime contract

```text
Koyeb exposed port 8000
        |
        | Koyeb exposes 8000 and sets PORT=8000
        v
entrypoint -> node custom-server.js -> Next standalone server
                                      |
                                      +-- HOSTNAME=0.0.0.0
                                      +-- reconcile a single KOYEB_PORT_* port
                                      +-- listen on PORT
                                      +-- GET /api/health -> 200
```

The image default remains `20128` for compatibility with existing Docker users.
Koyeb can either expose `20128` (recommended for consistency with the image) or
expose `8000` and allow its `PORT=8000` value to override the image default. The
application must support both through environment-driven port selection.

## Implementation decisions

- Set the image `EXPOSE` metadata to the default port (`20128`) and retain
  `ENV PORT=20128`; this preserves existing `docker run -p 20128:20128` usage.
- Ensure the npm `start` script does not override `PORT` with `20127`.
- Before starting Next, if exactly one `KOYEB_PORT_<PORT>_PROTOCOL` variable is
  present, use that exposed port. This repairs a stale `PORT` value left in the
  Service environment while retaining explicit `PORT` behavior for local Docker
  and multi-port edge cases.
- Keep `HOSTNAME=0.0.0.0` in the image.
- Make the Koyeb instructions explicit: configure exposed port `20128` and route
  `/`, or configure port `8000` together with `PORT=8000`. The first option is
  preferred because it matches the image default.
- Use `/api/health` for an optional HTTP health check. The route is already
  lightweight and does not require authentication or external providers.

## Compatibility and rollback

Existing Docker users continue to use port `20128`. Users who already configured
Koyeb on port `8000` can keep that service configuration if Koyeb's `PORT=8000`
variable is present; otherwise they should change the exposed port to `20128`.
Rollback is limited to reverting the deployment-contract files and redeploying
the previous image.

## Validation

Validate source configuration statically, run the focused server/health test,
run lint/type checks available in the repository, and run `npm run build`. Docker
is not installed in the local environment, so the exact Koyeb image cannot be
executed locally unless Docker becomes available; the final handoff must include
the required Koyeb port setting.
