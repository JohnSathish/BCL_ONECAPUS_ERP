# Website CMS data-source adapters

Institution websites are **CMS-first**. ERP modules are optional adapters declared per tenant in `WebsiteSite.settingsJson.sources`.

## Contract

```ts
type ContentSource =
  | { mode: 'MANUAL' }
  | {
      mode: 'ERP';
      adapter: 'academicCalendar' | 'department' | 'staff' | 'programme';
    };
```

Defaults live in `apps/api/src/modules/website/website-cms.registry.ts` (`DEFAULT_CONTENT_SOURCES`).

## Current adapters

| Key              | Adapter            | Behavior                                                                                                             |
| ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `departments`    | `department`       | ERP `WebsiteDepartmentProfile` + Department masters when `mode: ERP`; MANUAL allows CMS-only publish                 |
| `faculty`        | `staff`            | Staff profiles with `showOnWebsite`                                                                                  |
| `programmes`     | `programme`        | Programme listings via academic projectors                                                                           |
| `upcomingEvents` | `academicCalendar` | Reads `settingsJson.calendarItems` marked `showOnWebsite` (bridge until a full ERP Academic Calendar model is wired) |
| `noticeBoard`    | MANUAL             | `WebsiteNotice` table                                                                                                |
| `news`           | MANUAL             | CPT `news` entries                                                                                                   |

## Adding a new ERP adapter

1. Extend the `adapter` union in the registry + admin `homepage-sections` mirror.
2. Implement a projector in `WebsiteCmsEnterpriseService` or a dedicated adapter class.
3. Honour MANUAL overrides when present; ERP fills gaps only when `mode: 'ERP'`.
4. Expose public data on `/v1/website/public/...` without college-specific hardcoding.
5. Document the new key here and seed `settingsJson.sources` for new tenants.

## Revalidation

On publish, admin can call `POST /v1/website/admin/revalidate`. Configure:

- `WEBSITE_REVALIDATE_WEBHOOK_URL` env, or
- `settingsJson.revalidateWebhookUrl`

college-web listens at `/api/revalidate` and revalidates the `website-cms` tag.
