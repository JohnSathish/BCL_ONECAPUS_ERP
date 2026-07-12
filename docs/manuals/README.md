# BCL OneCampus ERP — Enterprise User Manual

## Files

| File                                            | Purpose                                      |
| ----------------------------------------------- | -------------------------------------------- |
| `BCL-OneCampus-ERP-Enterprise-User-Manual.html` | **Deliverable** — open in Chrome/Edge        |
| `bcl-logo.png` / `onecampus-logo.png`           | Cover logos (keep beside the HTML)           |
| `generate-manual.mjs`                           | Regenerates the HTML from structured content |

## How to view

1. Open `BCL-OneCampus-ERP-Enterprise-User-Manual.html` in Chrome or Edge (double-click or drag into the browser).
2. Keep the logo PNG files in the **same folder** as the HTML.
3. Use the left sidebar to jump between chapters.

## How to export PDF (print-ready book)

1. Click **Print / PDF** in the sidebar (or press `Ctrl+P`).
2. Destination: **Save as PDF** / **Microsoft Print to PDF**.
3. Paper size: **A4**.
4. Margins: **Default** (CSS already sets A4 `@page` rules).
5. Enable **Background graphics** so cover gradients and navy headers print.
6. Save and send to commercial binding if required.

## Screenshot placeholders

Search the HTML for `[Insert` — each dashed frame is reserved for a production screenshot. Replace the frame contents with `<img src="…">` when assets are ready.

## Regenerating

```bash
node docs/manuals/generate-manual.mjs
```

## Support

- Website: https://basecodelabs.com
- Email: contact@basecodelabs.com
- Phone: +91 95663 63655
- Licensing: licensing@basecodelabs.com

Document version: DOC-2026.07 · Product: BCL OneCampus ERP 1.0.0
