# Mutual NDA Creator (PL-3)

Next.js frontend for the prelegal prototype: a single-page web app that lets a
user fill in the cover-page fields for a Common Paper Mutual NDA (Version 1.0),
see the completed agreement render live, and download a print-ready PDF via the
browser's print dialog.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

- `src/app/page.tsx` is a Server Component. It reads
  `../templates/Mutual-NDA.md` (the Common Paper Standard Terms) from the
  repo's `templates/` dataset and passes the markdown into the client app.
- `src/components/nda-app.tsx` holds the form state. The form (left) and
  rendered NDA (right) are kept in sync as the user types.
- `src/components/nda-preview.tsx` renders the cover page as JSX (using the
  user's inputs, with bracketed placeholders for empty fields) followed by the
  Standard Terms rendered with `react-markdown`.
- The "Download PDF" button calls `window.print()`. Print styles in
  `globals.css` hide the form/header and let the browser export the preview as
  a PDF.

The Common Paper templates are licensed CC BY 4.0; see `../templates/LICENSE.txt`.
