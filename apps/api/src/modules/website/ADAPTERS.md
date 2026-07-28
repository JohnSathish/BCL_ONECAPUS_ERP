# Website CMS data-source adapters

Institution websites are **CMS-first**. ERP modules are optional adapters declared per tenant in `WebsiteSite.settingsJson.sources`.

## Content safety (migrations / seed / import)

`importWebsiteContent`, `seedDefaults`, and `ensureHomepageLayout` are **fill-missing only**:

- Existing `settingsJson.homepage` (footer, research links, coat of arms, sister institutions, etc.) is never replaced with code defaults.
- Homepage section `enabled` / `position` are preserved (editors own layout).
- Pages, menu items, hero slides, news, notices, and CPT entries are created only when missing.
- Website Settings saves **merge** branding fields into `settingsJson` and must not wipe homepage CMS.

Code defaults in `DEFAULT_HOMEPAGE_CONTENT` apply only to brand-new empty sites.

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

| Key              | Adapter            | Behavior                                                                                                                                                                                                                                                      |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `departments`    | `department`       | ERP `WebsiteDepartmentProfile` + Department masters when `mode: ERP`; MANUAL allows CMS-only publish                                                                                                                                                          |
| `faculty`        | `staff`            | Staff profiles with `showOnWebsite`                                                                                                                                                                                                                           |
| `programmes`     | `programme`        | Programme listings via academic projectors                                                                                                                                                                                                                    |
| `upcomingEvents` | `academicCalendar` | Reads published `AcademicCalendarEvent` rows (`visibility=PUBLIC`, `publishedToWebsite`, calendar `PUBLISHED`). Falls back to `settingsJson.calendarItems` only when no ERP events exist. **Primary source** — Website CMS “Event list (fallback)” is legacy. |
| `noticeBoard`    | MANUAL             | `WebsiteNotice` table                                                                                                                                                                                                                                         |
| `news`           | MANUAL             | CPT `news` entries                                                                                                                                                                                                                                            |

Public handbook Year Planner (`GET /v1/website/public/academic-planner`) builds month grids from the Working Day Engine for the published ERP Academic Calendar when available; otherwise falls back to CMS `website_academic_planner_*` tables (legacy — admin nav labels this “Handbook planner (legacy)”).

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
