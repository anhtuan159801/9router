# Koyeb port and health-check research

## Source

- Koyeb, Exposing your Service:
  https://www.koyeb.com/docs/build-and-deploy/exposing-your-service
- Koyeb, Health Checks:
  https://www.koyeb.com/docs/run-and-scale/health-checks
- Koyeb, Troubleshooting Deployments:
  https://www.koyeb.com/docs/build-and-deploy/troubleshooting-tips

## Findings

- Koyeb Web Services always define `PORT`. If the Service does not explicitly
  set it, Koyeb derives it from the lowest exposed port.
- Koyeb exposes `KOYEB_PORT_<PORT>_PROTOCOL` for each Service port at build and
  runtime; a single value identifies the port configured for this web process.
- The Service exposed port and the port used by the process must match. Koyeb's
  default health check is TCP on each exposed port; an HTTP health check can be
  configured per port.
- A lightweight HTTP route is suitable for this application because
  `GET /api/health` does not require authentication or external provider access.

## Application decision

Preserve `20128` as the Docker default for existing users. For the current Koyeb
configuration, either expose `20128` or set `PORT=8000` while exposing `8000`.
The wrapper also reconciles a single Koyeb exposed-port variable when a stale
`PORT=20128` remains, while the Service should still be cleaned up to avoid a
misleading configuration.
