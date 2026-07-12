# ERP UI / UX patterns (admin)

Use these shared building blocks for all admin module work. Prefer extending them over page-local CSS.

## Page chrome

- Shell: `AdminPortalShell` → page content via `DashboardShell` or `ErpPageLayout` / `ErpPageHeader`
- Title + one short subtitle; primary CTA top-right
- Breadcrumbs when nesting deeper than 2 levels

## Lists / tables

- Prefer `components/erp/data-table.tsx` or module tables that match its spacing
- Always provide: loading skeleton, empty message (`role="status"`), error via `QueryErrorPanel`
- Pagination: page/limit from API `meta`; never fetch unbounded lists in the UI

## Forms

- Use `components/erp/form-primitives.tsx` + `components/ui/*`
- Required fields marked; inline validation messages; disable submit while pending
- Destructive actions: confirmation dialog

## Feedback

- Errors: `QueryErrorPanel` or toast with actionable text
- Success: toast (consistent duration)
- Never leave a blank white panel on failure

## Accessibility

- Icon-only buttons need `aria-label`
- Focus visible (`:focus-visible`) on interactive chrome
- Skip link to `#main-content` on admin shell
- Tables: column headers present; empty states announced

## Responsive

- No horizontal page scroll on tablet; tables scroll inside a container
- Touch targets ≥ 40px on primary actions where mobile nav is used
