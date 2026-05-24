<p align="center">
  <img src="assets/logo.png" width="150" alt="OmniKey AI Logo"/>
</p>
<h1 align="center">OmniKey AI: Unified Key Manager</h1>
<p align="center">
  <strong>One OpenAI-compatible endpoint. Twelve free LLM providers. ~1B+ tokens per month.</strong><br/>
  <em>One bearer token → speak to 60+ models offline or online — OmniKey AI routes, falls over, and tracks budget transparently</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-0078D6?style=flat-square" alt="Platform Support" />
  <img src="https://img.shields.io/badge/Language-TypeScript-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Tailwind-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Why OmniKey AI?](#-why-omnikey-ai)
- [Features](#-features)
- [Architecture](#-architecture)
- [Pipeline Flow](#-pipeline-flow)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Dependencies](#-dependencies)
- [Configuration](#-configuration)
- [Roadmap](#-roadmap)
- [Author](#-author)

---

## 🔍 Overview

**OmniKey AI** is a self-hosted, OpenAI-compatible proxy that wraps 12 free-tier LLM providers—Gemini, OpenRouter, Cerebras, Groq, Mistral, GitHub Models, SambaNova, Cohere, Cloudflare, Z.ai (Zhipu), HuggingFace, and NVIDIA—into a single API. Instead of dealing with multiple API keys, client SDKs, rate limits, and failure modes, you get a single endpoint (`/v1/chat/completions`) and a single unified API key.

Behind the scenes, OmniKey AI handles secure key storage (encrypted at rest using AES-256-GCM), keeps track of rate limits and token budgets for each provider key, dynamically selects the best available model, and seamlessly falls back to backup providers if your active connection fails or hits a rate limit.

---

## 🎯 Why OmniKey AI?

> **Most developers want access to a variety of models but don't want to pay high costs or manage multiple API keys. OmniKey AI handles this complexity for you.**

| Feature | Manual Multi-Provider Integration | OmniKey AI |
|---|---|---|
| **API Endpoints** | A dozen different URLs and payload formats | Single `/v1/chat/completions` endpoint |
| **API Keys** | 12 separate keys to rotate, secure, and manage | One unified key (`omnikey-...`) stored securely |
| **Failover** | Manual retry logic; app crashes when provider is down | Automatic fallback to backup providers in milliseconds |
| **Rate-Limits (429)** | Request fails immediately | Transparent retry across next best provider |
| **Usage Tracking** | Custom logging per platform to track free caps | Automatic local tracking of daily/monthly token usage |
| **Privacy** | Credentials stored in plain-text `.env` files | AES-256-GCM envelope encryption in local SQLite |
| **Visuals** | CLI-only or no interface | Modern React-based dashboard with real-time stats |

---

## ✨ Features

### 🔑 Key Management
| Feature | Description |
|---|---|
| **AES-256-GCM Encryption** | All upstream provider API keys are encrypted at rest using envelope encryption. |
| **Unified Token** | Uses a custom `omnikey-` prefixed key to authenticate your local clients. |
| **Mock Keys Support** | Allows testing and sandbox query paths using mock keys. |

### 🚀 Dynamic Routing & Failover
| Feature | Description |
|---|---|
| **Virtual "auto" Model** | Requests to `auto` automatically route to the highest priority active provider. |
| **Automatic Fallback** | Cascades down a customizable pipeline when encountering 429 or 500 errors. |
| **Intelligent Re-routing** | Dynamically skips exhausted keys without caller awareness. |

### 📊 Real-Time Dashboard
| Feature | Description |
|---|---|
| **Model Catalog** | Complete list of 60+ models, their states, and active status. |
| **Usage Gauges** | Clean visuals illustrating token budgets and daily/monthly stats. |
| **Settings Panel** | Live drag-and-drop fallback chain ordering and configuration. |

---

## 🏗 Architecture

```mermaid
graph TD
    subgraph ClientApp["Clients (SDKs, IDEs, Web apps)"]
        CL["OpenAI SDK / Continue.dev / Cursor"]
    end

    subgraph Proxy["OmniKey AI Proxy Node"]
        API["Express Server\n/v1/chat/completions"]
        SEC["Security Layer\nAES-256-GCM Auth Check"]
        DB["SQLite Database\nKeys · Logs · Configurations"]
        ROUT["Routing Engine\nFallback Pipeline & Priorities"]
    end

    subgraph Providers["Upstream LLM Providers"]
        GEM["Google Gemini"]
        GROQ["Groq"]
        CERE["Cerebras"]
        SAMB["SambaNova"]
        OPEN["OpenRouter"]
        COH["Cohere"]
        OTH["Others (Mistral, NVIDIA, etc.)"]
    end

    CL -->|Bearer omnikey-key| API
    API --> SEC
    SEC --> DB
    API --> ROUT
    ROUT --> GEM
    ROUT --> GROQ
    ROUT --> CERE
    ROUT --> SAMB
    ROUT --> OPEN
    ROUT --> COH
    ROUT --> OTH
```

<details>
<summary>ASCII fallback (click to expand)</summary>

```
┌──────────────────────────────────────────────────────────────┐
│                    Clients (OpenAI SDK / IDEs)               │
│                                │                             │
│                                ▼ Bearer omnikey-key          │
├──────────────────────────────────────────────────────────────┤
│                     OmniKey AI Proxy                         │
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────────┐  │
│  │   Express API        │◄────►│   Security & Auth        │  │
│  │   /v1/chat/completions│     │   AES-256-GCM            │  │
│  └──────────┬───────────┘      └────────────┬─────────────┘  │
│             │                               │                │
│             ▼                               ▼                │
│  ┌──────────────────────┐      ┌──────────────────────────┐  │
│  │   Routing Engine     │◄────►│   SQLite DB              │  │
│  │   Fallback Pipeline  │      │   Keys, Logs, Stats      │  │
│  └──────────┬───────────┘      └──────────────────────────┘  │
└─────────────┼────────────────────────────────────────────────┘
              │
              ├──► Google Gemini
              ├──► Groq / Cerebras / SambaNova
              ├──► OpenRouter / Cohere
              └──► Others (Cloudflare, Mistral, NVIDIA...)
```

</details>

---

## 🔄 Pipeline Flow

```mermaid
flowchart TD
    A["Client Chat Request"] --> B["Verify Unified Key\n(Bearer omnikey-...)"]
    B -->|Valid| C{"Specific Model\nRequested?"}
    B -->|Invalid| Err["401 Unauthorized"]
    C -->|Yes| D["Find Active Provider\nSupporting Model"]
    C -->|No / 'auto'| E["Select Top Provider\nfrom Fallback Chain"]
    D --> F["Check Token Budget\n& Quota Limits"]
    E --> F
    F -->|Available| G["Execute API Call\nto Provider"]
    F -->|Exhausted| H["Attempt Next Provider\nin Fallback Chain"]
    G -->|200 OK| I["Log Usage Metrics\n& Return Output"]
    G -->|429 / 5xx| H
    H -->|Has Alternatives| F
    H -->|No Alternatives| J["429/500 Error response"]
```

<details>
<summary>ASCII fallback (click to expand)</summary>

```
Client Chat Request
     │
     ▼
Verify Unified Key (Bearer omnikey-...)
     │
     ├─► [Invalid] ──► 401 Unauthorized
     ▼
     [Valid]
     │
     ▼
Identify Target Model (Specific or "auto")
     │
     ▼
Select Best Available Provider (using Fallback Chain priorities)
     │
     ├─► [Budget Exhausted] ──► Cascade to next provider
     ▼
     [Quota Available]
     │
     ▼
Submit Request to Upstream Provider
     │
     ├─► [429 / 5xx Error] ────► Try next provider in fallback pipeline
     ▼
     [200 Success Response]
     │
     ▼
Log Token Usage to SQLite database & return JSON to client
```

</details>

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm (or yarn / pnpm)
- SQLite3

### Install & Run

```bash
# 1. Clone the repository
git clone https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager.git
cd OmniKey-AI-Unified-Key-Manager

# 2. Install dependencies
npm install

# 3. Create environment file and generate encryption key
cp .env.example .env
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" >> .env

# 4. Run database migrations and seed models
# (automatically handled at server startup)

# 5. Start server and client together in development mode
npm run dev
```

---

## 📁 Project Structure

```
OmniKey-AI-Unified-Key-Manager/
├── package.json         # Workspace orchestrator
├── .gitignore          # Repository ignores
├── README.md           # This file
├── LICENSE             # MIT License
├── client/             # Frontend Dashboard (Vite + React + TS)
│   ├── src/
│   │   ├── App.tsx     # Main dashboard interface
│   │   └── index.css   # Main styles
│   └── index.html
├── server/             # Express API (Node.js + TS)
│   ├── src/
│   │   ├── db/         # SQLite schema initialization and seed
│   │   ├── providers/  # Upstream integration adapters
│   │   ├── routes/     # Proxy and keys API router
│   │   ├── services/   # Routing engine and limit enforcement
│   │   └── index.ts    # Application entry point
│   └── data/           # Database directory (gitignored)
└── shared/             # Shared Types & Schemas
    └── src/types.ts    # Model interfaces & platforms
```

---

## 📚 Dependencies

| Module | Purpose |
|---|---|
| `express` | Web server framework for the completions proxy and dashboard API |
| `sqlite3` | SQLite database driver for local keys and statistics |
| `dotenv` | Environment configuration manager |
| `cors` | Cross-Origin Resource Sharing middleware |
| `concurrently` | Development runner for concurrent client/server dev servers |
| `vitest` | Unit testing and proxy route simulation |
| `react` & `vite` | Client interface stack |

---

## ⚙️ Configuration

All configuration is loaded from the environment variables in your `.env` file:

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server port for incoming client API requests |
| `ENCRYPTION_KEY` | *(Required)* | 32-byte hex key used to encrypt and decrypt provider keys |
| `DATABASE_URL` | `./server/data/freeapi.db` | Absolute or relative path to SQLite database file |

---

## 🗺️ Roadmap

- [ ] **Multi-Key Allocation**: Support adding multiple keys per provider and auto-balancing between them.
- [ ] **Streaming Fallbacks**: Re-route stream connections mid-generation if the socket drops.
- [ ] **Advanced Usage Graphs**: Detailed usage graphs by provider, model, and client token source.
- [ ] **Desktop Tray Minimization**: Packaging server as a system-tray background daemon.

---

## 👤 Author

**Felix-au** (Harshit Soni)

- 🔗 GitHub: [github.com/Felix-au](https://github.com/Felix-au)
- 📧 Email: [harshit.soni.23cse@bmu.edu.in](mailto:harshit.soni.23cse@bmu.edu.in)

---

<p align="center">
  <sub>Built for developers who want a single, smart API key for a billion free LLM tokens.</sub>
</p>
