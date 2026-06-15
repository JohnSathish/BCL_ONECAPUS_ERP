# Pre-launch load test (k6)

Simulates peak launch traffic:

- 200 concurrent student dashboard loads
- 500 concurrent admission portal info requests
- 300 concurrent fee summary lookups

## Prerequisites

- Docker (k6 runs in `grafana/k6` image)
- API running locally (`npm run dev`) or staging reachable from Docker

## Run

```bash
# Quick smoke (5 VUs, 30s) — use while developing
npm run load:test:smoke

# Full 2-minute scenarios (plan target)
npm run load:test
```

The runner adds `--add-host=host.docker.internal:host-gateway` so the k6 container can reach your host API on Linux and Windows.

## Environment

| Variable           | Default (local dev)                    |
| ------------------ | -------------------------------------- |
| `BASE_URL`         | `http://host.docker.internal:3001/api` |
| `TENANT_SLUG`      | `demo`                                 |
| `STUDENT_EMAIL`    | `student@demo.edu`                     |
| `STUDENT_PASSWORD` | `Student@123`                          |

**Docker Compose / nginx on port 80:**

```bash
BASE_URL=http://host.docker.internal/api npm run load:test:smoke
```

**Staging:**

```bash
BASE_URL=https://staging.example.com/api TENANT_SLUG=donbosco npm run load:test
```

Thresholds: p95 &lt; 2s (full test), check pass rate &gt; 90%.
