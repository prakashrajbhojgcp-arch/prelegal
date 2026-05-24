# PL-7 — Support multiple users and final polish

**Status:** Design approved 2026-05-24 · target branch: `PL-7`
**Ticket:** https://prakashrajbhoj.atlassian.net/browse/PL-7

## Problem

The platform currently uses fake-auth (any email + name signs you in), nothing the user creates is persisted across page reloads or sessions, the screens read as engineering prototypes rather than a SaaS product, and there is no on-screen acknowledgement that the generated documents are drafts. PL-7 closes those gaps.

## Goals

1. Replace fake-auth with real email + password sign-up / sign-in.
2. Persist a user's documents across the current server lifetime so they can resume editing or re-download.
3. Make it impossible for a user to overlook that the documents are drafts needing legal review.
4. Polish the highest-impact screens to feel like a professional SaaS product.
5. Update `frontend/CLAUDE.md` to reflect the post-PL-7 state.

## Non-goals (explicit out-of-scope for this PR)

- Email verification, password reset, "forgot password" flows.
- A cross-template "My Documents" page in the sidebar — drafts live on each creator page only.
- Persisting chat-message history (only the merged document state is saved).
- Redesigning the chat UI, form inputs, preview, or PDF layout beyond the disclaimer footer.
- Persistent SQLite across restarts (CLAUDE.md says the DB is recreated each container start; that stays).

## Architecture

### 1. Authentication

- Add `password_hash TEXT NOT NULL` to the `users` table. DB resets per restart so no migration needed.
- Library: `passlib[bcrypt]` for hashing and verification. Use the default cost factor.
- `backend/src/prelegal_backend/users.py`
  - `create_with_password(conn, *, email, name, password) -> User` — hashes, inserts, returns user; raises `EmailAlreadyRegistered` on UNIQUE violation.
  - `verify_password(conn, *, email, password) -> User | None` — fetches by email, returns the `User` on match or `None` on any mismatch.
- `backend/src/prelegal_backend/auth.py`
  - `POST /api/auth/signup` (new) — body `{email, name, password}`. Creates user, issues session cookie, returns `UserOut`. 409 on duplicate email; 422 on validation (`email` invalid, `name` empty, `password` < 8 chars).
  - `POST /api/auth/login` (rewritten) — body `{email, password}` (no more `name`). Verifies via `users.verify_password`. 401 on unknown email *or* wrong password with the same `"Invalid email or password"` detail (don't leak which side failed). Issues cookie on success.
  - `GET /api/auth/me`, `POST /api/auth/logout` unchanged.
- Frontend `/login` page consolidates sign-in and sign-up into one `AuthForm` component with `mode: "signin" | "signup"` toggled by pill buttons. Hand-rolled client validation (matches the existing `LoginForm` style; no new validation library): non-empty email, non-empty name in signup mode, password ≥ 8 chars. Server returns the canonical error message for anything more nuanced. Two-column layout as described in §4.

### 2. Document persistence

- New SQLite table:
  ```sql
  CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_documents_user_slug ON documents(user_id, slug, updated_at DESC);
  ```
- New module `backend/src/prelegal_backend/documents.py`:
  - `Document` dataclass (id, user_id, slug, title, fields, created_at, updated_at) — `fields` parsed from `fields_json` lazily on read.
  - CRUD helpers: `create`, `list_for_user(slug=None)`, `get_by_id(user_id, id)`, `update(id, *, title=None, fields=None)`, `delete(user_id, id)`. All require `user_id` for ownership scoping and raise `DocumentNotFound` if the row exists but belongs to another user *or* doesn't exist (don't leak existence).
  - `derive_title(spec, fields)` — fallback title generator: if the spec is `mutual-nda`, use `"<party1.company> ↔ <party2.company>"`; for generic templates, use `parties[0].company` + `parties[1].company`; if both empty, use `"<spec.name> draft"`.
- New router `backend/src/prelegal_backend/documents_router.py` mounting at `/api/documents`:
  | Verb + path | Body | Returns |
  | --- | --- | --- |
  | `POST /` | `{slug, title?, fields}` | `201 {id, slug, title, fields, updatedAt}` |
  | `GET /?slug=<slug>` | — | `200 [{id, slug, title, updatedAt}]` (no fields blob, ordered `updated_at DESC`) |
  | `GET /{id}` | — | `200 {id, slug, title, fields, updatedAt}` or `404` |
  | `PATCH /{id}` | `{title?, fields?}` | `200 {…full doc}` or `404` |
  | `DELETE /{id}` | — | `204` or `404` |
  - 400 on unknown slug. All endpoints require `current_user`.
- Mounted alongside the other routers in `main.py`.
- Frontend module `frontend/src/lib/templates/documents-client.ts` mirrors the API: `listDocuments(slug?)`, `createDocument({slug, fields, title?})`, `getDocument(id)`, `updateDocument(id, {fields?, title?})`, `deleteDocument(id)`. Shape uses camelCase (`updatedAt`).
- UX changes in `TemplateChatApp` and `NdaChatApp`:
  - **`<SavedDraftsPanel slug={spec.slug} />`** rendered above the chat sidebar (left column of the two-column grid). Self-contained: fetches its own list on mount; emits `onResume(documentId)` upward via context or a callback prop. Empty-state copy: *"No saved drafts of this template yet."*
  - **Save draft button** in the header row, immediately left of Download. Tracks `currentDocumentId` in the chat-app's state. First click → `createDocument(...)`. Subsequent clicks → `updateDocument(currentDocumentId, ...)`. Shows inline status: `Save draft` → `Saving…` → `Saved 3s ago` (relative timestamp updates every 30s while idle).
  - **Resume flow**: clicking a draft fetches `getDocument(id)`, sets `currentDocumentId`, replaces `fields` with the saved snapshot, and resets the chat to just the spec's greeting (`spec.greeting`). An inline ephemeral note (auto-dismiss after ~5s, plain `aria-live="polite"` div — no new toast library) explains: *"Loaded draft. Chat starts fresh; the document fields are restored."*
  - **Delete flow**: clicking the trash icon in a draft row opens a `<ConfirmDialog />` (native `<dialog>` or a small custom one — match existing UI patterns). On confirm, `deleteDocument(id)` then refetches the list. If the deleted draft was the active one, clear `currentDocumentId` and reset to a fresh `spec.defaultData()`.

### 3. Draft disclaimer

- Single source of truth in `frontend/src/lib/disclaimer.ts`:
  ```ts
  export const DISCLAIMER_FULL =
    "Prelegal generates drafts. Every document is subject to legal review before signing. This is not a substitute for legal advice.";
  export const DISCLAIMER_FOOTER =
    "Draft — generated by Prelegal. Subject to legal review. Not a substitute for legal advice.";
  ```
- **Creator-page banner** — new `frontend/src/components/draft-disclaimer-banner.tsx`. Amber palette (`bg-amber-50`, `border-amber-200`, `text-amber-900`), warning icon, `role="note"`, `aria-label="Draft disclaimer"`, `className="no-print …"`. Rendered as the first child of `TemplateChatApp` and `NdaChatApp` (so it sits above the title row).
- **PDF footer** — add a `<View fixed>` inside each `<Page>` in `frontend/src/lib/templates/mutual-nda/pdf-document.tsx` and `frontend/src/lib/templates/generic/pdf-document.tsx`. Style: small grey centered text 28pt from the bottom edge. The `fixed` prop ensures it renders on every page including breaks.
- **Dashboard note** — slim single-line amber row between the `<RecommendGateway />` and the template grid in `frontend/src/app/dashboard/page.tsx`. Lighter than the creator banner (no icon, smaller text).

### 4. Polish

- **Login screen (`/login`)** — two-column layout in `frontend/src/app/login/page.tsx`:
  - Left (hidden below `md:`): `bg-brand-navy` panel with the Prelegal name in `text-brand-yellow text-2xl font-bold`, tagline `Draft legal documents in minutes, with AI.`, three bullet value props with check icons, and a footnote in muted yellow with the disclaimer short copy.
  - Right: white card containing an `<AuthForm />` with a two-pill toggle (`Sign in` | `Sign up`) above the inputs. The submit button copy follows the mode (`Sign in` / `Create account`). Brand-purple button.
- **App shell (`frontend/src/app/dashboard/layout.tsx`)**:
  - **Top bar**: Prelegal wordmark left, `<UserMenu />` right. The user menu is an avatar circle (`bg-brand-purple text-white`) with the user's first initial; clicking opens a dropdown with the user's full name + email and a **Sign out** button. Replaces the existing standalone `<LogoutButton />`.
  - **Sidebar**: keep the existing "Templates" link and active-route highlight; no new nav items (we deliberately chose not to ship a separate "My Documents" page).
- **Dashboard (`/dashboard`)**: prepend a hero block with an H1 "Draft a document" and a subtitle explaining the flow. Tighten card grid spacing slightly; add a subtle hover lift on cards via existing classes.
- **Creator pages**: header row tightened; Save and Download buttons sit in a clean right-aligned group; status text (`Saved 3s ago`) sits under the buttons.

### 5. CLAUDE.md update

Rewrite the "Current state" paragraph and "Implementation status" bullets in `frontend/CLAUDE.md` to describe post-PL-7 reality: real email+password auth, document persistence per user, draft disclaimer placements, polished SaaS auth/dashboard/creator screens. Drop the line claiming fake-auth.

## Data flow

```
Sign up
  Browser → POST /api/auth/signup {email,name,password}
         ← 201 + Set-Cookie + UserOut
  Browser → router.push("/dashboard")

Save draft (first time on this session)
  Creator → POST /api/documents {slug, fields, title=derive}
         ← 201 {id, ...}
  Creator stores currentDocumentId locally

Save draft (subsequent)
  Creator → PATCH /api/documents/{id} {fields, title}
         ← 200 {...}

List drafts (mount)
  Panel → GET /api/documents?slug=<slug>
       ← 200 [{id, title, updatedAt}, …]

Resume draft
  Panel → GET /api/documents/{id}
       ← 200 {fields, ...}
  Creator setFields(fields); setCurrentDocumentId(id); resetChat()

Delete draft
  Panel → DELETE /api/documents/{id}
       ← 204
  Panel refetches list; if id===currentDocumentId, clear state
```

## Error handling

- **Auth errors** rendered inline in the form (`role="alert"`). Network failures show a generic "Could not reach the server" message. 409 on signup is rendered as "An account already exists for that email."
- **Save errors** show a small red status next to the Save button: "Could not save — retry?" with a retry button that re-invokes the last mutation. We do not retry automatically.
- **Resume errors** surface as an inline alert above the drafts panel ("Could not load that draft.") using the same `aria-live="polite"` div as the success note.
- **Delete errors** keep the row in place and surface "Could not delete — retry?" inline.
- 401 anywhere in the document-router flow means the session expired; redirect the user to `/login` via `router.push`.

## Testing

Test pyramid stays the same as PL-6: backend pytest + frontend vitest, no Playwright (Chrome isn't installed on the host).

### Backend (`backend/tests/`)

- **`test_auth.py`**:
  - signup happy path issues cookie + returns UserOut
  - signup duplicate email → 409 with the standard message
  - signup `password` < 8 chars → 422
  - login wrong password → 401 "Invalid email or password"
  - login unknown email → 401 "Invalid email or password"
  - `/me` without cookie → 401, with cookie → 200
  - logout clears cookie

- **`test_documents.py`**:
  - create → returns row with derived title when title omitted
  - create with explicit title preserves it
  - list filters by slug, sorted by updated_at desc
  - list does not include other users' rows (cross-user isolation)
  - get-by-id of another user's row → 404
  - patch updates only provided fields; updated_at advances
  - delete of another user's row → 404; delete of own row → 204
  - all endpoints without cookie → 401

- Reuse existing fixtures (`auth_client`) — extended to call `signup` with a real password.

### Frontend (`frontend/src/`)

- **`auth-form.test.tsx`**: sign-in mode hides name input; sign-up mode requires name; client validation flags too-short password; submit calls the right endpoint via fetch mock; 409 / 401 errors render inline.
- **`saved-drafts-panel.test.tsx`**: empty state copy; renders fetched list; Resume button calls onResume; Delete opens confirm dialog; Confirm calls deleteDocument and refetches.
- **`draft-disclaimer-banner.test.tsx`**: renders the full copy and has `role="note"`.
- Existing tests (`recommend-gateway`, `nda-chat-app`, `nda-chat`, `nda-edit-panel`) updated to mount the disclaimer-banner-aware component tree (likely no test changes needed since the banner is auxiliary).
- Add a smoke test for the dashboard inline note (`dashboard-page.test.tsx`? optional — SSR already covered).

## Open questions

None. All scoping decisions captured above were confirmed with the user during brainstorming.

## Deliberately not in scope

- Email verification, password reset.
- Persistent SQLite across restarts.
- Chat-history persistence (only document state is saved).
- "My Documents" cross-template nav page.
- Full visual overhaul of chat UI, form components, or preview.
- Magic-link / OAuth.
