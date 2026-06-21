# OmniKey AI: Unified Key Manager — Quick Guide

An OpenAI-compatible proxy that routes across 12 free-tier LLM providers. Point any OpenAI client library at your local proxy server, and it routes transparently across whichever providers you've added keys for.

> [!IMPORTANT]
> **Unlike cloud API routers** that centralize credentials, OmniKey AI is **entirely self-hosted**. Your upstream API keys are stored in a local SQLite database on your machine, encrypted using AES-256-GCM envelope encryption. Credentials and prompts never leave your local environment.

---

## Table of Contents

- 🚀 [How to Run](#how-to-run)
  - [Option A: Development Mode (Vite and Express)](#option-a-development-mode-vite-and-express)
  - [Option B: Production Build](#option-b-production-build)
- 🎯 [How to Use](#how-to-use)
- 🗣️ [Example Queries](#example-queries)
  - [Option 1: OpenAI Compatible Endpoint](#option-1-openai-compatible-endpoint)
  - [Option 2: Gemini Compatible Endpoint](#option-2-gemini-compatible-endpoint)
- 🔵 [Dashboard Interface](#dashboard-interface)
- ⚙️ [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
- ⚠️ [Important Notes](#important-notes)
- 📁 [Important Files](#important-files)

---

## How to Run

### Option A: Development Mode (Vite and Express)

**Prerequisites:** Node.js 20+, npm, SQLite3.

```bash
# 1. Synchronize dependencies
npm install

# 2. Setup your env file and generate a crypto key
cp .env.example .env
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" >> .env

# 3. Start development server + dashboard together
npm run dev
```

On first launch, the server will create a local SQLite database at `server/data/OmniKeyAI.db`, run migrations, seed 25+ model configurations, and start:
* Express server on `http://localhost:3001`
* Vite React Dashboard on `http://localhost:5173`

### Option B: Production Build

```bash
# Build the client app and the server bundle
npm run build

# Start the compiled Express server
node server/dist/index.js
```

> [!NOTE]
> In production mode, the React dashboard client is statically served directly from the Express server. You only need to run the Node server, and the dashboard is available on the same port (e.g., `http://localhost:3001`)

## How to Use

1. **Launch OmniKey AI** — Start the backend proxy server.
2. **Open the Dashboard** — Navigate to the React dashboard.
3. **Add Upstream Keys** — Go to the **Keys** tab and paste your API keys. They are immediately encrypted and saved, checking automatically to reject duplicate credentials.
4. **Order the Fallback Chain** — Drag and drop providers to establish your priority chain.
5. **Get your Unified Keys** — Display and copy either your OpenAI-compatible master key (`omnikey-...`) or your Gemini-compatible master key (`omnikey-g-...`) from the **Keys** page.
6. **Query the Proxy** — Point your client libraries (OpenAI SDK to `/v1` or Gemini SDK to `/v1beta`) at the local proxy server.

---

## Example Queries

### Option 1: OpenAI Compatible Endpoint

#### Curl Command
```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer omnikey-your-unified-openai-key-here" \
  -d '{
    "model": "auto",
    "messages": [
      {
        "role": "user",
        "content": "Why is the sky blue?"
      }
    ]
  }'
```

#### Python SDK
```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:3001/v1",
    api_key="omnikey-your-unified-openai-key-here"
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain quantum computing in one sentence."}]
)

print(response.choices[0].message.content)
```

### Option 2: Gemini Compatible Endpoint

#### Curl Command (Non-Streaming)
```bash
curl -X POST "http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-unified-gemini-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Why is the sky blue?"}]
      }
    ]
  }'
```

#### Curl Command (Streaming SSE)
```bash
curl -X POST "http://localhost:3001/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=omnikey-g-your-unified-gemini-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Why is the sky blue?"}]
      }
    ]
  }'
```

---

## Dashboard Interface

The React Dashboard is your command center. It features persistent support for **Light/Dark Themes** across all views (including the login screen and interactive pages), toggled easily from the header controls.

| Tab / Section | Description |
|---|---|
| **Models Page** | Interactive explorer listing 100+ models with sorting, search, column configuration, item counts, and availability check indicators. |
| **Keys Page** | Manage OpenAI and Gemini unified keys side-by-side. Store upstream credentials with duplicate protection, authenticated CSV export/import, and dynamic status toggling. |
| **Fallback Chain** | Sort the provider priority chain dynamically using drag-and-drop. |
| **Stats & Logs** | Track token consumption, daily/monthly totals, and historical query latency. |
| **Playground** | Interactive chat workspace with an API Format toggle (OpenAI vs. Gemini format), browser-based microphone Voice recording, and modality selections to test query responses in real-time. |
| **Dev Corner** | Premium sandbox featuring format toggling, Voice (speech-to-response/transcription) sandbox testing, auto-compiling JS template generators for both OpenAI/Gemini formats, streaming output rendering, and a direct testing console. |
| **Debate Arena** | Stage structured debates between two model personas (In Favor vs. Against) under a Judge model, with automatic chat history sanitization. |
| **Admin Console (`/admin`)** | High-level operations center monitoring user distributions, success rates, latency distributions, error breakdowns, and overall savings (in Rupees `₹`). Enables editing model catalogs globally, inspecting logs (with resolved Developer Emails), and rotating admin login credentials (secured with HMAC-SHA256). |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | The backend proxy listener port |
| `ENCRYPTION_KEY` | *(None)* | 32-byte hex string used to encrypt local API keys |
| `DATABASE_URL` | `./server/data/OmniKeyAI.db` | Path where the SQLite database will be stored |
| `MONGODB_URI` | *(Optional)* | Cloud database cluster address for multi-tenant deployments |
| `FIREBASE_PROJECT_ID` | *(Optional)* | Firebase gateway configuration ID for multi-tenant authentication |

> [!NOTE]
> `LOCAL_DB_ENABLED` has been deprecated. Mode selection (Local SQLite vs. Cloud MongoDB Atlas) is determined by user preference on the client-side login UI and persists automatically in browser storage. Multi-tenant token patterns starting with `omnikey-` automatically route to MongoDB collections, enabling simultaneous multi-client operations. A quick **Switch to Local** toggle is available in the header next to the database status label.

---

## Important Notes

- **Render / Keep-Alive Cron** — The API provides a public `/api/cron-health` endpoint returning server uptime status. You can ping this every 2 minutes via a cron-job to prevent deployment instances from sleeping.
- **Health Check Timestamps** — Upstream provider credential verification checks record and render precise local execution timestamps.
- **Provider ToS** — Your usage is governed by the Terms of Service of each individual upstream provider.
- **Encryption Loss** — If you lose or change your `ENCRYPTION_KEY`, you will not be able to decrypt your stored keys and will need to re-enter them.
- **Database Backup** — Your configurations, stats, and logs are kept in `server/data/OmniKeyAI.db`. Keep backups of this file.
- **Confirmation Dialogs** — The application utilizes custom theme-token matched Confirmation Modals instead of native browser popups to ensure consistent styling.

---

## Important Files

| File | Purpose |
|---|---|
| `server/src/index.ts` | Server orchestrator and HTTP server entry point |
| `server/src/db/context.ts` | Per-request database connection context router (`AsyncLocalStorage`) |
| `server/src/services/router.ts` | Fallback routing logic and active model selection |
| `server/src/routes/proxy.ts` | OpenAI-compatible completions proxy route with multi-tenant credential auto-routing |
| `server/src/routes/gemini-proxy.ts` | Gemini-compatible proxy routing endpoint translating request & response bodies |
| `server/src/routes/ping.ts` | Keep-alive heartbeat endpoints (/api/cron-health) |
| `client/src/pages/DevCornerPage.tsx` | Interactive sandbox configuration form and dynamic JS template generator |
| `client/src/pages/DebatePage.tsx` | AI Debate Arena page implementing multi-agent structured debate orchestration |
| `client/src/App.tsx` | Single-page dashboard application view |
| `shared/src/types.ts` | Common schema typings between client and server |

---

<p align="center">
  <sub>Built for developers who want a single, smart API key for a billion free LLM tokens.</sub>
</p>
