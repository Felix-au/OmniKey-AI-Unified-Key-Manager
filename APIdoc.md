# OmniKey AI: Unified Key Manager — API Reference

> OmniKey AI exposes an OpenAI-compatible web API. Developers can point their client SDKs directly to the proxy server to query any of the 60+ integrated models. Below is the API reference detailing authentication, request formats, response structures, and client integrations.

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Chat Completions Request Format](#chat-completions-request-format)
- [Chat Completions Response Format](#chat-completions-response-format)
- [Streaming Completions](#streaming-completions)
- [Models Endpoint](#models-endpoint)
- [Dashboard Management APIs](#dashboard-management-apis)
- [Integration Examples](#integration-examples)

---

## Authentication

Client requests to the proxy server are authenticated using one of two master unified keys:

### 1. OpenAI-Compatible Format
* **Key Prefix**: `omnikey-[32-byte-hex-string]`
* **Method**: Pass in the `Authorization` header.
```http
Authorization: Bearer omnikey-your-unified-openai-key-here
```

### 2. Gemini-Compatible Format
* **Key Prefix**: `omnikey-g-[32-byte-hex-string]`
* **Method**: Pass as the `key` query-string parameter.
```text
http://localhost:3001/v1beta/models/...:generateContent?key=omnikey-g-your-unified-gemini-key-here
```

> [!WARNING]
> Requests without a valid API key, or containing an incorrect token, will receive a `401 Unauthorized` response.

---

## Endpoints

| HTTP Method | Path | Description | Access |
|---|---|---|---|
| **POST** | `/v1/chat/completions` | Create a chat completion (OpenAI compatible) | Client |
| **GET** | `/v1/models` | List all supported models (OpenAI compatible) | Client |
| **POST** | `/v1beta/models/:model:generateContent` | Generate a Gemini-compatible completion | Client |
| **POST** | `/v1beta/models/:model:streamGenerateContent` | Stream a Gemini-compatible completion | Client |
| **GET** | `/v1beta/models` | List all supported models (Gemini format) | Client |
| **GET** | `/v1beta/models/:model` | Retrieve model info details (Gemini format) | Client |
| **GET** | `/api/cron-health` | Public uptime keep-alive check for cloud hosting | Public |
| **GET** | `/api/config` | Backend capability discovery configurations | Public |
| **GET** | `/api/keys` | Retrieve statuses and profiles of upstream keys | Dashboard |
| **POST** | `/api/keys` | Add or update an upstream provider key | Dashboard |
| **GET** | `/api/fallback-config` | Get the current fallback priority chain | Dashboard |
| **POST** | `/api/fallback-config` | Update the priority order of fallback providers | Dashboard |
| **GET** | `/api/stats/usage` | Fetch daily and monthly token consumption stats | Dashboard |
| **POST** | `/api/admin/login` | Log in as admin and obtain a session token | Public Admin |
| **GET** | `/api/admin/stats` | Retrieve administrative dashboard stats (Savings in ₹) | Auth Admin |
| **POST** | `/api/admin/change-credentials` | Update username/password (Hashed with HMAC-SHA256) | Auth Admin |
| **POST** | `/api/admin/toggle-model` | Globally enable or disable a model in the catalog | Auth Admin |
| **POST** | `/api/admin/flush-logs` | Delete recent proxy request audit trails | Auth Admin |

---

## Chat Completions Request Format

**Endpoint:** `POST /v1/chat/completions`

### Request Body (JSON)

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | String | Yes | Name of the model to target (e.g. `gemini-2.5-flash`), or `"auto"` to use the priority fallback model. |
| `messages` | Array | Yes | List of message objects representing the conversation history. |
| `temperature` | Float | No | Controls generation randomness (0.0 to 2.0). Default is `1.0`. |
| `max_tokens` | Integer | No | Maximum number of tokens to generate in the completion. |
| `stream` | Boolean | No | If `true`, returns a Server-Sent Events (SSE) stream of token chunks. |

### Message Objects

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | String | Yes | The role of the message author: `system`, `user`, or `assistant`. |
| `content` | String or Array | Yes | The text content of the message. |

### Example Request Payload

```json
{
  "model": "auto",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful programming assistant."
    },
    {
      "role": "user",
      "content": "Write a python function to compute fibonacci."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150
}
```

---

## Chat Completions Response Format

### Success Response (`200 OK`)

Returns a standard OpenAI completion envelope:

```json
{
  "id": "chatcmpl-12345",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gemini-2.5-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here is the fibonacci function:\n\n```python\ndef fib(n):\n    return n if n <= 1 else fib(n-1) + fib(n-2)\n```"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 42,
    "total_tokens": 67
  }
}
```

### Error Responses

#### `401 Unauthorized`
Unified key is missing or incorrect.
```json
{
  "error": {
    "message": "Unauthorized: Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

#### `429 Too Many Requests`
All available provider keys are exhausted or rate-limited.
```json
{
  "error": {
    "message": "All providers exhausted or rate-limited for this model",
    "type": "rate_limit_error",
    "code": "model_rate_limited"
  }
}
```

---

## Streaming Completions

If `"stream": true` is passed, the proxy response is sent as a `text/event-stream`. Each chunk follows this structure:

```text
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"auto","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"auto","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}

data: [DONE]
```

---

## Models Endpoint

**Endpoint:** `GET /v1/models`

Returns list of all models currently active in your configuration.

### Example Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-2.5-flash",
      "object": "model",
      "created": 1677652288,
      "owned_by": "google"
    },
    {
      "id": "llama-3.3-70b-versatile",
      "object": "model",
      "created": 1677652288,
      "owned_by": "groq"
    },
    {
      "id": "auto",
      "object": "model",
      "created": 1677652288,
      "owned_by": "omnikey"
    }
  ]
}
```

---

## Gemini-Compatible Request/Response Format

**Endpoint:** `POST /v1beta/models/:model:generateContent?key=omnikey-g-your-unified-gemini-key-here`

### Request Body (JSON)

| Field | Type | Required | Description |
|---|---|---|---|
| `contents` | Array | Yes | Array of content objects representing message turns. |
| `generationConfig` | Object | No | Configuration settings for model parameters (e.g. `temperature`, `maxOutputTokens`). |
| `systemInstruction` | Object | No | System instruction to guide model responses. |

### Contents Turn Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | String | Yes | Author role: `"user"` or `"model"`. |
| `parts` | Array | Yes | List of part objects. Each part must contain a `"text"` property. |

### Example Gemini Request Payload

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "Write a python function to compute fibonacci."}]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 150
  },
  "systemInstruction": {
    "parts": [{"text": "You are a helpful programming assistant."}]
  }
}
```

### Success Response (`200 OK`)

Returns the normalized Gemini response structure:

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "text": "Here is the fibonacci function:\n\n```python\ndef fib(n):\n    return n if n <= 1 else fib(n-1) + fib(n-2)\n```"
          }
        ]
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 25,
    "candidatesTokenCount": 42,
    "totalTokenCount": 67
  }
}
```

---

## Gemini Streaming Completions

**Endpoint:** `POST /v1beta/models/:model:streamGenerateContent?key=omnikey-g-your-unified-gemini-key-here`

If requesting streaming, the response is delivered as a Server-Sent Events (SSE) stream of JSON candidate objects or a comma-separated array stream. Example SSE data chunk:

```text
data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hello"}]},"finishReason":null}],"usageMetadata":{"promptTokenCount":25,"candidatesTokenCount":5,"totalTokenCount":30}}

data: {"candidates":[{"content":{"role":"model","parts":[{"text":"!"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":25,"candidatesTokenCount":6,"totalTokenCount":31}}
```

---

## Dashboard Management APIs

These local endpoints are used by the React frontend to update key databases and configurations:

### 1. Update Upstream API Key (`POST /api/keys`)
```json
{
  "platform": "google",
  "apiKey": "AIzaSy..."
}
```
*Note: Stored securely using symmetric AES-256-GCM.*

### 2. Update Fallback Chain Config (`POST /api/fallback-config`)
```json
{
  "chain": ["google", "groq", "sambanova", "cerebras", "openrouter"]
}
```

### 3. Public Keep-Alive Cron Pinger (`GET /api/cron-health`)
A public endpoint used to ping the server to keep it active (e.g. preventing Render sleep modes).
**Response Shape (`200 OK`):**
```json
{
  "status": "ok",
  "timestamp": "2026-05-24T18:43:00.000Z",
  "dbMode": "local"
}
```

### 4. Configuration Capability Discovery (`GET /api/config`)
Retrieves capabilities of the host server environment configuration at runtime.
**Response Shape (`200 OK`):**
```json
{
  "cloudDbAvailable": true,
  "defaultLocalMode": false
}
```

---

## Admin Console APIs (`/api/admin`)

These endpoints manage administrative actions and overall dashboard statistics:

### 1. Admin Login (`POST /api/admin/login`)
Verify credentials and create an in-memory session token.
* **Payload:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```
* **Response Shape (`200 OK`):**
```json
{
  "success": true,
  "token": "admin-session-token-uuid"
}
```

### 2. Admin Overall Statistics (`GET /api/admin/stats`)
Fetch comprehensive stats on platform usage, latency distribution, top errors, model catalogs, and active developer records. Requires header `Authorization: Bearer <admin-session-token-uuid>`.
* **Response Shape (`200 OK`):**
```json
{
  "success": true,
  "system": {
    "totalUsers": 2,
    "totalKeys": 5,
    "activeKeys": 4,
    "totalRequests": 1200,
    "successRate": 99.2,
    "overallCostSaved": 4.524,
    "averageCostSavedPerRequest": 0.00377,
    "averageLatencyMs": 420
  },
  "platformBreakdown": [
    {
      "platform": "google",
      "totalRequests": 800,
      "successRate": 99.5,
      "tokensProcessed": 1200000,
      "avgLatencyMs": 350,
      "costSaved": 3.25
    }
  ],
  "recentLogs": [
    {
      "createdAt": "2026-05-24T18:43:00.000Z",
      "platform": "google",
      "modelId": "gemini-2.5-flash",
      "status": "success",
      "latencyMs": 320,
      "inputTokens": 1000,
      "outputTokens": 2000,
      "error": null,
      "userId": "user-uid",
      "userEmail": "developer@example.com"
    }
  ]
}
```
*Note: The frontend dashboard converts and renders the `overallCostSaved` and `averageCostSavedPerRequest` values to INR (Rupees ₹) at a rate of 83 INR/USD.*

### 3. Update Admin Credentials (`POST /api/admin/change-credentials`)
Updates admin login credentials. Passwords are deterministic HMAC-SHA256 hashed on persistence. Requires Bearer Admin Token.
* **Payload:**
```json
{
  "newUsername": "admin",
  "newPassword": "newPassword123"
}
```

### 4. Toggle Model Status (`POST /api/admin/toggle-model`)
Enables or disables a model globally across proxy routers. Requires Bearer Admin Token.
* **Payload:**
```json
{
  "platform": "google",
  "modelId": "gemini-2.5-flash",
  "enabled": false
}
```

### 5. Flush Logs (`POST /api/admin/flush-logs`)
Wipes audit log directory. Requires Bearer Admin Token.

---

## Integration Examples

### Node.js (OpenAI SDK)
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'omnikey-your-unified-openai-key-here',
  baseURL: 'http://localhost:3001/v1'
});

const chatCompletion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Explain APIs like I am five.' }],
  model: 'auto',
});

console.log(chatCompletion.choices[0].message.content);
```

### Node.js (Google Gen AI SDK)
```javascript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: 'omnikey-g-your-unified-gemini-key-here',
  // Configure endpoint to point to the local proxy
  baseUrl: 'http://localhost:3001'
});

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Explain APIs like I am five.',
});

console.log(response.text);
```

### cURL (OpenAI Compatible)
```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer omnikey-your-unified-openai-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello world!"}]
  }'
```

### cURL (Gemini Compatible)
```bash
curl -X POST "http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-unified-gemini-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Hello world!"}]
      }
    ]
  }'
```

---

<p align="center">
  <sub>Built for developers who want a single, smart API key for a billion free LLM tokens.</sub>
</p>
