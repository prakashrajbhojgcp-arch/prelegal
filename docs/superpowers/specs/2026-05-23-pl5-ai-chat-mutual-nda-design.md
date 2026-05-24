# PL-5: AI chat for Mutual NDA

**Status:** Approved
**Date:** 2026-05-23
**Jira:** [PL-5 — Add AI chat but still just mutual NDA](https://prakashrajbhoj.atlassian.net/browse/PL-5)
**Branch:** PL-5 (new branch off `main`)

## Background

PL-4 shipped the dashboard shell, and PL-4 follow-ups wired the existing PL-3
Mutual NDA creator into the route `/dashboard/templates/mutual-nda` (form on
the left, live preview on the right, client-side PDF download). The other 11
templates remain "Coming soon" placeholders.

PL-5 swaps the form-driven interaction on that one route for a free-form chat
with an AI that asks about the document, asks questions about each field, and
populates the same `NdaData` state from the user's answers. The remaining 11
templates stay "Coming soon" — the ticket title makes this explicit: "Add AI
chat but still just mutual NDA".

## Goals

- A signed-in user can hold a free-form chat at `/dashboard/templates/mutual-nda`
  and the live NDA preview updates as the AI extracts fields.
- All LLM calls go through the Cerebras provider via LiteLLM/OpenRouter using
  `openrouter/openai/gpt-oss-120b` with Structured Outputs, as mandated by
  `frontend/CLAUDE.md`.
- The existing `NdaForm` survives as a collapsible "Edit fields manually"
  panel beneath the chat, so power users can patch fields by hand.
- Client-side PDF download keeps working end-to-end with the same file name
  convention (`Mutual-NDA-<Party1>-<Party2>.pdf`).
- Existing auth gating (`/dashboard/*` middleware + `current_user` dependency
  on backend) protects the new chat endpoint.

## Non-goals

- Wiring any other template (CSA, SLA, PSA, DPA, etc.) to a chat or a creator.
  They stay "Coming soon".
- Persisting chat history or `NdaData` across reloads (the SQLite DB is wiped
  on every container start; PL-5 keeps state in the browser).
- Token streaming. Cerebras inference on `gpt-oss-120b` is sub-second; we use
  non-streaming Structured Outputs for an atomic reply + field-update payload.
- Real authentication, multi-user document workspace, server-side PDF
  generation, tool-calling beyond the single Structured-Outputs schema.
- Changing the catalog (`config.json`) or the `/api/templates` payload.

## Architecture

### Per-turn data flow

```
[Browser: NdaChatApp]                  [Backend: chat.py]                [OpenRouter → Cerebras]
  user types ─►
  POST /api/templates/mutual-nda/chat
    { messages, current_fields } ───►  handle_turn()
                                         ├─ build system prompt + history
                                         ├─ litellm.completion(
                                         │     model="openrouter/openai/gpt-oss-120b",
                                         │     response_format=ChatTurn,
                                         │     reasoning_effort="low",
                                         │     extra_body={"provider":{"order":["cerebras"]}})
                                         │                                  ─────►  gpt-oss-120b
                                         ├─ ChatTurn.model_validate_json(…) ◄─────  JSON
                                         └─ deep-merge updated_fields into current_fields
   ◄── { assistant_message, merged_fields, is_complete }
  setState({...})
  preview re-renders from merged_fields
  Download PDF stays client-side (unchanged from PL-4)
```

### Persistence

None. Chat thread + field state live in `NdaChatApp` component state for the
session only. Reload starts over. A "Start over" button clears state.

### Auth

The new endpoint sits under `/api/templates/mutual-nda/chat` and uses the
existing `Depends(current_user)` dependency from `auth.py`, so unauthenticated
callers get 401. The Next.js route is already gated by
`frontend/src/middleware.ts` (`/dashboard/:path*`) and `dashboard/layout.tsx`.

## Backend design

### New module: `backend/src/prelegal_backend/nda_schema.py`

Hand-mirrored Pydantic models for `NdaData`. Mirrors the existing TS types in
`frontend/src/lib/nda-schema.ts` 1:1 — same field names, same discriminated
unions for the term pickers (`MndaTerm`, `ConfidentialityTerm`). A
`PartialNdaData` companion (every leaf field optional) is used as the LLM's
output schema for the per-turn diff.

Snake_case in Python (`effective_date`, `governing_law`); the wire is
camelCase to match the TS shape, via `Field(alias=…)` + `model_config =
ConfigDict(populate_by_name=True)`.

### New module: `backend/src/prelegal_backend/chat.py`

```python
router = APIRouter(prefix="/api/templates/mutual-nda", tags=["mutual-nda-chat"])

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]      # full thread the browser holds
    current_fields: NdaData

class ChatResponse(BaseModel):
    assistant_message: str
    merged_fields: NdaData
    is_complete: bool

class ChatTurn(BaseModel):           # Structured-Outputs schema for the LLM
    assistant_message: str
    updated_fields: PartialNdaData
    is_complete: bool

@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    _: Annotated[User, Depends(current_user)],
) -> ChatResponse:
    return handle_turn(body.messages, body.current_fields)
```

`handle_turn(messages, current_fields)`:

1. Cap `messages` at the 60 most-recent (always keep index 0 if it's the
   greeting).
2. Build the LiteLLM messages list: one `system` prompt + the bounded history.
3. Call `litellm.completion(model="openrouter/openai/gpt-oss-120b",
   messages=…, response_format=ChatTurn, reasoning_effort="low",
   extra_body={"provider": {"order": ["cerebras"]}})`.
4. Parse with `ChatTurn.model_validate_json(response.choices[0].message.content)`.
5. If `assistant_message.strip() == ""`, raise `HTTPException(502,
   "AI returned an empty message")`.
6. Deep-merge `updated_fields` (only non-`None` leaves) into `current_fields`
   to produce `merged_fields`.
7. Return `ChatResponse`.

LLM exceptions → `HTTPException(502, "AI service unavailable")`. No retries
inside the endpoint; the user can resend.

### System prompt

A short, plain-English prompt that:

- States the model is helping draft a Common Paper Mutual NDA (Version 1.0).
- Lists the required fields in plain English (parties, purpose, effective
  date, MNDA term, confidentiality term, governing law, jurisdiction,
  modifications, signer name/title/notice address per party).
- Embeds a JSON snapshot of `current_fields` under a header like
  `"Document state so far:"` so the model knows which fields are already
  filled and never re-asks for them. (This is how manual edits made in the
  edit panel reach the model too — see Error handling.)
- Tells the model to ask **one or two short questions at a time**, never a
  fire-hose.
- Tells the model to populate `updated_fields` ONLY for fields the latest user
  message clarified — do not echo state back.
- Tells the model to set `is_complete=true` once every required field is
  non-empty and it has confirmed the draft with the user; otherwise `false`.

### Wiring

- `backend/pyproject.toml` gains two dependencies: `litellm` and
  `python-dotenv` (the latter so local `uv run` picks up `OPENROUTER_API_KEY`
  from the repo `.env`; in Docker the variable is passed through directly).
- `main.py` adds `app.include_router(chat.router)` alongside `auth.router`
  and `templates.router`.
- `docker-compose.yml` backend service gains
  `OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}` so the secret reaches the
  container. The variable is read from the repo `.env` by Docker Compose.

## Frontend design

### Route

`frontend/src/app/dashboard/templates/mutual-nda/page.tsx` swaps
`<NdaApp …>` for `<NdaChatApp …>`. Same SSR props (`standardTerms`,
`standardTermsBlocks`) for the PDF.

### Components

- **`src/components/nda-chat-app.tsx`** (new) — owns three pieces of state:
  - `messages: ChatMessage[]` (seeded with one client-built assistant
    greeting; see below)
  - `fields: NdaData` (initialized via `defaultNdaData()`)
  - `status: "idle" | "sending" | "error"` (+ `errorMessage` when relevant)
  - Renders the same page header (title + Download PDF button) and a two-pane
    body: `<NdaChat>` left (360px), `<NdaPreview>` right (1fr). Below the
    grid, full-width: `<NdaEditPanel>` collapsed by default.
  - Lifts the PDF download wiring verbatim from `nda-app.tsx`.

- **`src/components/nda-chat.tsx`** (new) — left column. Chat thread + textarea
  + send button. Auto-scrolls to bottom on new messages. Shows a "typing…"
  affordance while `status === "sending"`. On submit:
  1. Optimistically appends `{ role: "user", content }` to `messages`.
  2. Calls `sendChatTurn(...)`.
  3. On success: appends `{ role: "assistant", content: assistant_message }`,
     replaces `fields` with `merged_fields`, and surfaces a small
     `✓ Ready to download` chip next to the Download PDF button when
     `is_complete` is true.
  4. On failure: sets `status: "error"`, shows a retry banner under the
     textarea (the original user message stays in the thread; the retry
     re-POSTs the same payload).
  - Header has a "Start over" button that clears `messages` back to the
    greeting and resets `fields` to `defaultNdaData()`.

- **`src/components/nda-edit-panel.tsx`** (new) — thin wrapper around the
  existing `<NdaForm>` inside a `<details>` element labeled "Edit fields
  manually" (closed by default). When the user edits a field here, the change
  flows straight into `fields`. No special chat-thread plumbing is required:
  every outgoing turn already sends the latest `current_fields`, and the
  system prompt embeds that snapshot, so the AI sees manual edits on the very
  next turn and stops re-asking for those fields.

### Reused components (unchanged)

- `NdaPreview` (right column) — already accepts `value: NdaData`.
- `NdaForm` — used inside `NdaEditPanel`; not modified.
- `NdaPdfDocument` and `@react-pdf/renderer` plumbing — moved into
  `NdaChatApp` unchanged.

### New client: `src/lib/nda-chat-client.ts`

Exports `async function sendChatTurn(messages, fields): Promise<ChatResponse>`.
Uses `fetch("/api/templates/mutual-nda/chat", { method: "POST", credentials:
"include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(...) })`.
On non-2xx, throws a typed `ChatError` carrying the backend `detail`.

### Initial greeting

Seeded client-side, no round-trip on mount:

> "Hi — I'll help you draft a Common Paper Mutual NDA. To start: what are the
> names of the two companies entering this agreement?"

### Old code disposition

`nda-app.tsx` becomes unreferenced. Delete it. Everything else
(`NdaForm`, `NdaPreview`, `nda-pdf-document.tsx`, `nda-schema.ts`,
`markdown-blocks.ts`) stays.

### Bounded transcript

The frontend caps `messages` at 60 entries before send (oldest dropped, index
0 always preserved if it's the greeting). Matches the backend cap so the cap
is consistent on either side.

### Concurrency

Send button is disabled while `status === "sending"`. No queuing.

## Error handling

| Scenario                                  | Behavior                                                                                                         |
|-------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Network failure / timeout                 | User message remains in thread. Retry banner under textarea with "Retry" button (re-POSTs same payload).         |
| Backend → LLM failure (502)               | Same retry banner; backend `detail` shown verbatim ("AI service unavailable") for debuggability.                 |
| Empty `assistant_message` from model      | Backend raises `HTTPException(502, "AI returned an empty message")`; frontend behavior identical to other 5xx.   |
| Schema validation failure (422)           | Same retry banner with FastAPI's validation detail. Should never fire if the TS/Pydantic mirror is in sync.      |
| `is_complete=true`                        | `✓ Ready to download` chip appears next to the Download PDF button. Chat stays open for refinement.              |
| Empty / whitespace-only user input        | Send button disabled (input is `trim()`-checked). Enter sends; Shift+Enter inserts a newline.                     |
| User edits a field manually mid-chat      | `fields` updates immediately. Next outgoing turn carries the updated `current_fields`; the AI sees the override via the snapshot in the system prompt. |
| PDF download with empty fields            | Allowed (matches today's form behavior). The PDF renders blanks where fields aren't filled.                       |
| Secret leakage                            | `OPENROUTER_API_KEY` never crosses the wire to the browser, never logged, never echoed in responses.              |

## Testing

### Backend (pytest)

- `test_nda_schema.py` — round-trip a sample `NdaData` JSON through Pydantic;
  assert discriminated unions reject bad `kind` values.
- `test_chat.py`
  - `test_chat_requires_auth` — POST without session cookie → 401.
  - `test_chat_handle_turn_merges_fields` — `litellm.completion` monkeypatched
    to return a known `ChatTurn` JSON; assert merged `NdaData` reflects only
    the changed fields and existing fields are preserved.
  - `test_chat_handle_turn_empty_message_raises_502` — patched response with
    empty `assistant_message`; assert 502.
  - `test_chat_handle_turn_llm_error_raises_502` — patched `completion` raises;
    assert 502.
  - `test_chat_bounded_history` — pass 100 messages; assert the call to
    `completion` receives at most 60 user/assistant messages (plus 1 system).
- **No live LLM calls in CI.** `litellm.completion` is monkeypatched in every
  test.

### Frontend unit (vitest)

- `nda-chat-app.test.tsx`
  - Renders initial greeting on mount.
  - Submitting a message calls the client, appends user + assistant messages,
    and updates the preview when `merged_fields` differ.
  - Send button disabled while in-flight; re-enabled and shows retry banner on
    a rejected promise.
  - "Start over" clears messages back to the greeting and resets fields to
    `defaultNdaData()`.
- `nda-chat-client.test.ts` — `sendChatTurn` POSTs the right shape; throws
  typed error on non-2xx (mock `fetch`).
- `nda-edit-panel.test.tsx` — toggling the panel reveals `<NdaForm>`; an edit
  fires the change callback, the parent's `fields` state updates, and the
  preview re-renders without sending a chat message.
- `nda-schema-parity.test.ts` — small assertion that the TS `NdaData` shape
  matches a fixture committed alongside the backend Pydantic schema, so drift
  is loud, not silent.

### E2E (Playwright)

One happy-path spec `frontend/e2e/mutual-nda-chat.spec.ts`:

- Log in via fake-auth.
- Navigate to `/dashboard/templates/mutual-nda`.
- Stub `POST /api/templates/mutual-nda/chat` with a sequence of canned
  `ChatResponse` payloads.
- Type three messages, assert preview updates after each, click Download PDF
  and assert a `Mutual-NDA-…pdf` download fires.
- Toggle "Edit fields", change a field, assert preview updates.

### What we do not test

- Live OpenRouter/Cerebras calls (cost + flakiness; covered by a manual smoke
  run before merge).
- Token streaming (we are not streaming).
- Concurrency on `/chat` (single-user V1).

### Manual smoke before PR

Bring up Docker, run through one Mutual NDA from greeting → completed → PDF
download. Verify no `OPENROUTER_API_KEY` appears in container logs.

## Open follow-ups (out of scope for PL-5)

- Persist documents server-side (would require a `documents` table and a
  durable DB; today's container wipes SQLite on restart).
- Per-template chat for the remaining 11 templates.
- Token streaming for nicer perceived latency on longer model responses.
- Tool-calling abstraction if more in-chat "actions" appear (e.g.
  `request_pdf`, `reset`).
