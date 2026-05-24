# OmniKey AI: Unified Key Manager — Quick Guide

An OpenAI-compatible proxy that routes across 12 free-tier LLM providers. Point any OpenAI client library at your local proxy server, and it routes transparently across whichever providers you've added keys for.

> [!IMPORTANT]
> **Unlike cloud API routers** that centralize credentials, OmniKey AI is **entirely self-hosted**. Your upstream API keys are stored in a local SQLite database on your machine, encrypted using AES-256-GCM envelope encryption. Credentials and prompts never leave your local environment.

## 🚀 How to Run

### Option A — Development Mode (Vite + Express)

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

### Option B — Production Build

```bash
# Build the client app and the server bundle
npm run build

# Start the compiled Express server
node server/dist/index.js
```

> [!NOTE]
> In production mode, the React dashboard client is statically served directly from the Express server. You only need to run the Node server, and the dashboard is available on the same port (e.g., `http://localhost:3001`).

---

## 🎯 How to Use

1. **Launch OmniKey AI** — Start the backend proxy server.
2. **Open the Dashboard** — Navigate to the React dashboard.
3. **Add Upstream Keys** — Go to the **Keys** tab and paste your API keys for Google Gemini, Groq, Cerebras, etc. They are immediately encrypted and saved.
4. **Order the Fallback Chain** — Drag and drop providers to establish your priority chain.
5. **Get your Unified Key** — Copy your `omnikey-...` API key from the header of the Keys page.
6. **Query the Proxy** — Point your OpenAI client or IDE configurations at the local server.

---

## 🗣️ Example Queries

### Curl Command

```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer omnikey-your-unified-key-here" \
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

### Python SDK

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:3001/v1",
    api_key="omnikey-your-unified-key-here"
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain quantum computing in one sentence."}]
)

print(response.choices[0].message.content)
```

---

## 🔵 Dashboard Interface

The React Dashboard is your command center. It features a responsive layout that persistent toggles between **Light/Dark Themes** directly from the header controls.

| Tab / Section | Description |
|---|---|
| **Overview / Models** | View active providers, token budget bars, and the full catalog of 60+ models. |
| **Keys Page** | Add, edit, or delete credentials. Display your unified key, export/import CSV datasets (authenticated), and toggle provider statuses. |
| **Fallback Chain** | Sort the provider priority chain dynamically using drag-and-drop. |
| **Stats & Logs** | Track token consumption, daily/monthly totals, and historical query latency. |
| **Dev Corner** | Interactive proxy completion form, dynamic JavaScript SDK snippet compiler, SSE streaming, and terminal sandbox console. |
| **Admin Console (`/admin`)** | High-level operations center monitoring user distributions, success rates, latency distributions, error breakdowns, and overall savings (in Rupees `₹`). Enables editing model catalogs globally, inspecting logs (with resolved Developer Emails), and rotating admin login credentials (secured with HMAC-SHA256). |

---

## ⚙️ Configuration

### Environment Variables (`.env` file)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | The backend proxy listener port |
| `ENCRYPTION_KEY` | *(None)* | 32-byte hex string used to encrypt local API keys |
| `DATABASE_URL` | `./server/data/OmniKeyAI.db` | Path where the SQLite database will be stored |
| `MONGODB_URI` | *(Optional)* | Cloud database cluster address for multi-tenant deployments |
| `FIREBASE_PROJECT_ID` | *(Optional)* | Firebase gateway configuration ID for multi-tenant authentication |

> [!NOTE]
> `LOCAL_DB_ENABLED` has been deprecated. Mode selection (Local SQLite vs. Cloud MongoDB Atlas) is determined by user preference on the client-side login UI and persists automatically in browser storage. Multi-tenant token patterns starting with `omnikey-` automatically route to MongoDB collections, enabling simultaneous multi-client operations.

---

## ⚠️ Important Notes

- **Render / Keep-Alive Cron** — The API provides a public `/api/cron-health` endpoint returning server uptime status. You can ping this every 2 minutes via a cron-job to prevent deployment instances from sleeping.
- **Health Check Timestamps** — Upstream provider credential verification checks record and render precise local execution timestamps.
- **Provider ToS** — Your usage is governed by the Terms of Service of each individual upstream provider.
- **Encryption Loss** — If you lose or change your `ENCRYPTION_KEY`, you will not be able to decrypt your stored keys and will need to re-enter them.
- **Database Backup** — Your configurations, stats, and logs are kept in `server/data/OmniKeyAI.db`. Keep backups of this file.

---

## 📁 Important Files

| File | Purpose |
|---|---|
| `server/src/index.ts` | Server orchestrator and HTTP server entry point |
| `server/src/db/context.ts` | Per-request database connection context router (`AsyncLocalStorage`) |
| `server/src/services/router.ts` | Fallback routing logic and active model selection |
| `server/src/routes/proxy.ts` | OpenAI-compatible completions proxy route with multi-tenant credential auto-routing |
| `server/src/routes/ping.ts` | Keep-alive heartbeat endpoints (/api/cron-health) |
| `client/src/pages/DevCornerPage.tsx` | Interactive sandbox configuration form and dynamic JS template generator |
| `client/src/App.tsx` | Single-page dashboard application view |
| `shared/src/types.ts` | Common schema typings between client and server |

---

<p align="center">
  <sub>Built for developers who want a single, smart API key for a billion free LLM tokens.</sub>
</p>
