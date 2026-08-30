# O2a private remote service runbook

This runbook prepares the O2a candidate for one Linux/systemd process on local
persistent storage behind private Tailscale Serve HTTPS. It does not authorize
or perform deployment, activation, cutover, publication, release, Funnel, or
public exposure. Adapt every example path and identity to the selected host
before an operator runs it.

Tailscale's current Serve documentation describes private tailnet HTTPS,
loopback reverse proxying, access-control enforcement, identity-header
sanitization, and persistent `--bg` configuration:

- <https://tailscale.com/docs/features/tailscale-serve>
- <https://tailscale.com/docs/reference/tailscale-cli/serve>

Do not use `tailscale funnel`. Serve and Funnel are different exposure modes;
Funnel is deliberately outside O2a.

## 1. Fixed topology

```text
tailnet browser
  -> Tailscale Serve HTTPS on the host
  -> 127.0.0.1:4318 remote gateway
  -> ephemeral 127.0.0.1 Studio upstream
  -> one SQLite/CAS workspace writer plus local O1 operations runtime
```

Only the first arrow crosses a host boundary. Both Node listeners remain on
loopback. Tailscale access control narrows network reachability; the separate
owner credential grants the browser session. The gateway never treats
Tailscale identity headers as Studio authority and never forwards them.

First-deployment assumptions:

- Linux host managed by systemd;
- Node.js 22 and the lockfile-pinned dependencies installed;
- one non-root service identity;
- local, persistent, non-symlinked filesystem roots;
- no containers, network filesystems, replicas, failover writers, or shared
  writable volumes;
- exact HTTPS DNS name known before the Node service starts.

## 2. Private roots and O1 configuration

Create four or more pairwise-disjoint roots owned by the service identity with
mode `0700`:

```text
/var/lib/numberdroid-studio/workspace
/var/lib/numberdroid-studio/operations
/var/lib/numberdroid-studio/backups
/var/lib/numberdroid-studio/restored-copies
```

The workspace, operations control root, every configured backup destination,
and every restore destination must each be an exact marked root. A parent root
does not cover a child and extra markers are rejected.

Create `/etc/numberdroid-studio` as an owner-only `0700` directory as well;
the configuration and credential setup commands reject a permissive final
parent directory.

From `tools/numberdroid-studio`, create each exclusive marker:

```bash
npm run remote:mark-mount -- /var/lib/numberdroid-studio/workspace workspace.primary
npm run remote:mark-mount -- /var/lib/numberdroid-studio/operations operations.primary
npm run remote:mark-mount -- /var/lib/numberdroid-studio/backups backups.primary
npm run remote:mark-mount -- /var/lib/numberdroid-studio/restored-copies restored.primary
```

Prepare the existing O1 operations configuration as owner-only
`/etc/numberdroid-studio/operations.json`:

```json
{
  "schemaVersion": 1,
  "controlRoot": "/var/lib/numberdroid-studio/operations",
  "backupDestinations": [
    {
      "destinationId": "backup.primary",
      "label": "Private host backups",
      "root": "/var/lib/numberdroid-studio/backups"
    }
  ],
  "restoreDestinations": [
    {
      "destinationId": "restore.primary",
      "label": "Quarantined restored copies",
      "root": "/var/lib/numberdroid-studio/restored-copies"
    }
  ]
}
```

The remote gateway exposes none of those O1 routes. The runtime is still
required locally so queued work and reconciliation retain their existing
durability guarantees.

## 3. Owner credential and remote configuration

Create the verifier while attached to a private controlling terminal:

```bash
npm run remote:credential -- /etc/numberdroid-studio/credential.json
```

The command refuses overwrite, writes mode `0600`, and displays one generated
256-bit credential only on the controlling terminal. Put that value directly
in a password manager. Do not place it in a shell argument, environment file,
URL, note inside the repository, or service log.

Prepare owner-only `/etc/numberdroid-studio/remote.json`. `publicOrigin` is the
exact Tailscale Serve HTTPS origin with no trailing slash:

```json
{
  "schemaVersion": 1,
  "publicOrigin": "https://numberdroid-host.example-tailnet.ts.net",
  "listen": {
    "host": "127.0.0.1",
    "port": 4318
  },
  "trustedProxyAddress": "127.0.0.1",
  "workspaceRoot": "/var/lib/numberdroid-studio/workspace",
  "operationsConfigurationFile": "/etc/numberdroid-studio/operations.json",
  "credentialFile": "/etc/numberdroid-studio/credential.json",
  "mounts": [
    { "mountId": "workspace.primary", "root": "/var/lib/numberdroid-studio/workspace" },
    { "mountId": "operations.primary", "root": "/var/lib/numberdroid-studio/operations" },
    { "mountId": "backups.primary", "root": "/var/lib/numberdroid-studio/backups" },
    { "mountId": "restored.primary", "root": "/var/lib/numberdroid-studio/restored-copies" }
  ]
}
```

Set the remote, operations, credential, and marker files to mode `0600`. The
configuration check opens no workspace writer:

```bash
npm run remote:check -- /etc/numberdroid-studio/remote.json
```

Any generic failure is a stop condition. Do not relax permissions, replace a
root with a symlink, add an unmarked destination, or bypass validation.

## 4. Supervised process

[`../deploy/systemd/numberdroid-studio-remote.service`](../deploy/systemd/numberdroid-studio-remote.service)
is a non-activated sample. Before installation, set the real service user,
repository path, Node path, configuration path, and every writable root. Keep
the unit's loopback-only composition and `UMask=0077`.

Foreground diagnosis, with an explicit shell timeout chosen by the operator:

```bash
npm run remote:start -- /etc/numberdroid-studio/remote.json
```

The process prints only a generic ready/failure line. `GET /livez` reports
process liveness. `GET /readyz` becomes ready only after storage, both writer
locks, the operations runtime, upstream, and gateway listener are active.

After installing the adapted unit, verify exactly one process and one owner:

```bash
systemctl status numberdroid-studio-remote.service
curl --fail --silent http://127.0.0.1:4318/readyz
```

A direct request to `/api/projects` without the trusted forwarded-header proof
must be rejected. Health endpoints are intentionally generic and contain no
project, path, credential, backup, job, MCP, or authority data.

## 5. Private HTTPS ingress

Tailscale Serve requires HTTPS enabled for the tailnet and applies tailnet
access-control rules. Confirm the selected node DNS name and restrict the ACL
to Klaus's intended devices/user before enabling Serve.

The current CLI form for a private persistent reverse proxy to the configured
loopback port is:

```bash
tailscale serve --bg 4318
tailscale serve status --json
```

The reported HTTPS origin must exactly equal `publicOrigin`. The HTTPS Serve
proxy must deliver one `X-Forwarded-Proto: https`, one matching
`X-Forwarded-Host`, and one IP-valued `X-Forwarded-For`; otherwise the gateway
fails closed. Do not add another proxy hop or use a public forwarding mode.

Before considering the candidate reachable, prove from a permitted tailnet
browser that:

- the exact HTTPS URL shows the Numberdroid owner sign-in page;
- a wrong credential yields only a generic failure;
- the correct credential yields the visible read-only Studio;
- the direct gateway port remains unavailable from LAN/tailnet clients;
- `tailscale serve status --json` shows Serve, not Funnel.

## 6. Session and shutdown operations

`/remote/account` supports explicit session rotation, current-browser logout,
and revoke-all. Restart invalidates all browser sessions by design while
preserving the durable workspace and operations state.

For maintenance, stop accepting HTTPS traffic, then stop the Node service and
wait for clean shutdown before filesystem or package work. Never start a second
writer against the same workspace. If startup reports a writer or operations
lock conflict, diagnose the existing process and mount identity; do not remove
the persistent SQLite lock sidecars.

Disabling an intentionally configured Serve mapping uses the matching official
Serve `off` form. Do not use `tailscale serve reset` on a host that serves other
unrelated applications without first reviewing its full Serve configuration.

## 7. Evidence and rollback limits

Record the exact candidate commit, Node/Tailscale versions, service-unit diff,
validated configuration fingerprint outside the repository, CI run, host
filesystem type, tailnet URL, ACL review, and observed return-test results.
Never record the raw owner credential.

Stopping the service and disabling its private Serve mapping removes remote
reachability. It does not delete or activate workspace, backup, or restored-copy
data. Restore-as-copy remains quarantined; O2a contains no cleanup, retention,
cutover, publication, or release action.
