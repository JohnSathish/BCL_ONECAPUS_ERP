# Universal app mode (multi-institution)

BCL OneCampus mobile can connect to **any compatible ERP deployment** from a single Play Store app.

## How it works

1. User opens the app → **Find your institution**
2. App stores `apiUrl` + `tenantSlug` on device (SecureStore)
3. All API calls use that server for the signed-in session. Institution can be changed from the welcome/login chip before signing in.

Legacy single-college EAS builds still work: if `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_TENANT_SLUG` are set at build time, the first launch auto-seeds that institution.

## School registry

Publish a JSON list of institutions (see `school-registry.example.json`):

```json
[
  {
    "id": "dbc-tura",
    "name": "Don Bosco College, Tura",
    "apiUrl": "https://erp.donboscocollege.ac.in/api",
    "tenantSlug": "demo",
    "region": "Meghalaya"
  }
]
```

Set in `.env` or EAS secrets:

```env
EXPO_PUBLIC_SCHOOL_REGISTRY_URL=https://basecodelabs.com/onecampus-schools.json
```

Optional inline override for testing:

```env
EXPO_PUBLIC_SCHOOL_REGISTRY_JSON=[{"id":"local","name":"Dev","apiUrl":"http://192.168.1.10:3001/api","tenantSlug":"demo"}]
```

## Deep links (optional)

Open the app pre-filled for an institution:

```
onecampus://select-school?api=https://erp.college.edu/api&tenant=demo&name=My%20College
```

## Adding a new isolated ERP client

1. Deploy that school's API (same mobile routes as OneCampus)
2. Add one row to the registry JSON
3. No new mobile release required (unless branding/package changes)

## White-label builds

For a college-branded Play listing only, keep using per-build `EXPO_PUBLIC_*` — the app skips the picker when those env vars are present on first launch.
