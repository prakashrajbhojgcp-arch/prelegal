# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

Current state (post-PL-6): fake-auth login (any email + name signs you in — no real
authentication yet), a Next.js shell with sidebar + top bar, and a dashboard listing
all 12 templates from the catalog. Every card is live and links to its creator
route. The Mutual NDA uses bespoke schema/form/preview/PDF components; the other
11 templates share a generic field-manifest-driven scaffold (chat → cover-page
preview → PDF). The dashboard also exposes a "Recommend a template" gateway: the
user describes what they need, the backend `/api/templates/recommend` endpoint
maps that intent to a catalog slug (or the closest substitute if the request is
unsupported), and a "Open creator →" button routes there. Real auth lands in a
later ticket.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation status

- All 12 dashboard cards link to `/dashboard/templates/<slug>`. Slugs are derived from the catalog filename (`Mutual-NDA.md` → `mutual-nda`).
- Mutual NDA (`/dashboard/templates/mutual-nda`) keeps its bespoke pipeline: `NdaChatApp` (`src/components/nda-chat-app.tsx`) composing `NdaChat`, `NdaEditPanel`, `NdaPreview`, with schema + PDF document under `src/lib/templates/mutual-nda/`.
- The other 11 templates (BAA, CSA, DPA, SLA, PSA, Software License, Partnership, Pilot, Design Partner, AI Addendum, Mutual NDA Cover Page) are served by the dynamic route `src/app/dashboard/templates/[slug]/page.tsx`, which looks up the spec via `getTemplateSpec(slug)` and hands it to `TemplateChatApp` (`src/components/template-chat-app.tsx`). Each per-template module under `src/lib/templates/<slug>/spec.ts` calls `buildGenericSpec(...)` with a field manifest; the generic scaffold (`src/lib/templates/generic/`) supplies the schema, spec builder, and PDF document; `src/components/generic-form.tsx` and `generic-preview.tsx` provide the Form/Preview UI.
- Chat round-trip: frontend `sendChatTurn(slug, messages, fields)` in `src/lib/templates/chat-client.ts` → backend `POST /api/templates/{slug}/chat` (`backend/src/prelegal_backend/templates/chat_router.py`) → `chat_engine.handle_turn(spec, ...)` calls LiteLLM (`openrouter/openai/gpt-oss-120b`, Cerebras provider) with the spec's partial model as the Structured Outputs schema; the spec's `deep_merge` applies non-None leaves onto the current snapshot.
- Recommend gateway: the `RecommendGateway` component (`src/components/recommend-gateway.tsx`) on `/dashboard` POSTs the user's free-text description to `/api/templates/recommend` (`backend/src/prelegal_backend/templates/recommend_router.py`). The router builds a system prompt that lists every catalog slug, asks the LLM to classify `kind: "supported" | "unsupported"` and pick the best-fit slug, then validates against the catalog (falls back to `mutual-nda` + `unsupported` if the model hallucinates). The UI then routes to `/dashboard/templates/<slug>` on click.
- Client-side PDF export: `@react-pdf/renderer` builds `<prefix>-<party1>-<party2>.pdf`. Mutual NDA uses `src/lib/templates/mutual-nda/pdf-document.tsx`; the other 11 templates use the generic `src/lib/templates/generic/pdf-document.tsx`. The "Download PDF" button is `data-testid="download-pdf"`.