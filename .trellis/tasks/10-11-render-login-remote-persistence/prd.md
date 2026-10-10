# Fix Render login remote persistence fetch error

## Goal

Restore dashboard password login on the Render deployment by identifying and
resolving the remote snapshot fetch failure reported as
`[Remote persistence] fetch failed (unknown)`.

## Confirmed facts

- `POST /api/auth/login` calls `getSettings()` before comparing the password.
- The settings repository initializes the database through `getAdapter()`,
  which must load the Supabase snapshot before it can serve the request.
- A remote snapshot fetch error therefore returns HTTP 500 before password
  validation; this message does not indicate an incorrect password.
- The deployed message `(unknown)` is consistent with an older store error
  formatter that only reports `error.code`; transport-level fetch failures
  often have no PostgREST code.
- Existing uncommitted changes already add nested fetch-cause details and clear
  failed database initialization so the process can retry. Preserve and review
  these changes; do not overwrite or revert them.
- The login route returns the caught error message in its HTTP 500 response but
  does not log it. The login page displays that response's `error` field, so the
  precise infrastructure cause can be captured from the page or the
  `/api/auth/login` network response after the diagnostic changes are deployed.

## Requirements

- Keep login fail-closed when the remote snapshot cannot be loaded; do not
  authenticate against potentially stale local settings.
- Report available Supabase/PostgREST and nested network error details without
  exposing secret values or snapshot contents.
- Close the local database adapter after failed remote initialization and allow
  a later request to retry initialization.
- Give the operator a concrete Render/Supabase follow-up based on the resulting
  error details.
- Preserve unrelated uncommitted changes in the working tree.
- Push the remote-persistence fix to `origin/master` so the configured Render
  deployment can build it; do not change Render service settings directly.

## Acceptance Criteria

- [ ] If the Supabase endpoint is reachable and configured correctly, login
      reaches password validation and returns its normal success or invalid
      password response instead of a remote-persistence 500.
- [ ] If remote fetch still fails, the login error response includes the
      available transport or PostgREST cause instead of only `(unknown)`, with
      no secret values.
- [ ] A failed remote initialization does not leave a rejected adapter promise
      cached for every subsequent request.
- [ ] The Render-side cause is narrowed from the returned runtime diagnostic (for
      example, DNS/connectivity, endpoint configuration, project availability,
      or HTTP authorization/schema response).

## Notes

- Lightweight task: the code path is localized to login settings lookup and
  remote snapshot initialization; no design or implementation artifact is
  needed unless the runtime evidence changes the scope.
- The user needs to provide the full login error or `/api/auth/login` response
  after the diagnostic changes are deployed. Redact secret values before
  sharing; the caught error is not currently written to Render logs.
- The user explicitly asked to push the change for Render testing.
