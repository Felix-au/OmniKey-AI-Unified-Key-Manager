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
- [Gemini-Compatible Request/Response Format](#gemini-compatible-requestresponse-format)
- [Gemini Streaming Completions](#gemini-streaming-completions)
- [Vision Modality (Multimodal)](#vision-modality-multimodal)
- [Voice (Speech Input & Transcription)](#voice-speech-input--transcription)
- [Text-to-Speech (TTS) Synthesis](#text-to-speech-tts-synthesis)
- [Promo Tier Restrictions & Modalities](#promo-tier-restrictions-and-modalities)
- [Dashboard Management APIs](#dashboard-management-apis)
- [Admin Console APIs](#admin-console-apis)
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
* **Base URL targets**:
  * **Local**: `http://localhost:3001/v1`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1`

### 2. Gemini-Compatible Format
* **Key Prefix**: `omnikey-g-[32-byte-hex-string]`
* **Method**: Pass as the `key` query-string parameter.
* **Examples**:
  * **Local**: `http://localhost:3001/v1beta/models/...:generateContent?key=omnikey-g-your-key`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/...:generateContent?key=omnikey-g-your-key`

> [!WARNING]
> Requests without a valid API key, or containing an incorrect token, will receive a `401 Unauthorized` response.

---

## Endpoints

### Base URL Endpoints
* **Local Development**: `http://localhost:3001`
* **Online Production Deployment**: `https://omnikey-ai-unified-key-manager.onrender.com`

| HTTP Method | Path | Description | Access | Modality Code |
|---|---|---|---|---|
| **POST** | `/v1/chat/completions` | Create a chat completion (OpenAI compatible) | Client | `chat` |
| **POST** | `/v1/chat/completions` | Create a vision completion (OpenAI compatible) | Client | `vision` (auto-detected) |
| **POST** | `/v1/audio/transcriptions` | Transcribe audio files to text (Voice) | Client | `audio_input` |
| **POST** | `/v1/audio/speech` | Synthesize text to speech (TTS) | Client | `audio_output` |
| **GET** | `/v1/models` | List all supported models (OpenAI compatible) | Client | - |
| **POST** | `/v1beta/models/:model:generateContent` | Generate a Gemini-compatible completion | Client | `chat` / `vision` / `audio_input` / `audio_output` |
| **POST** | `/v1beta/models/:model:streamGenerateContent` | Stream a Gemini-compatible completion | Client | `chat` / `vision` / `audio_input` / `audio_output` |
| **GET** | `/v1beta/models` | List all supported models (Gemini format) | Client | - |
| **GET** | `/v1beta/models/:model` | Retrieve model info details (Gemini format) | Client | - |
| **GET** | `/api/cron-health` | Public uptime keep-alive check for cloud hosting | Public | - |
| **GET** | `/api/config` | Backend capability discovery configurations | Public | - |
| **GET** | `/api/keys` | Retrieve statuses and profiles of upstream keys | Dashboard | - |
| **POST** | `/api/keys` | Add or update an upstream provider key | Dashboard | - |
| **GET** | `/api/fallback-config` | Get the current fallback priority chain | Dashboard | - |
| **POST** | `/api/fallback-config` | Update the priority order of fallback providers | Dashboard | - |
| **GET** | `/api/stats/usage` | Fetch daily and monthly token consumption stats | Dashboard | - |
| **POST** | `/api/admin/login` | Log in as admin and obtain a session token | Public Admin | - |
| **GET** | `/api/admin/stats` | Retrieve administrative dashboard stats (Savings in ₹) | Auth Admin | - |
| **POST** | `/api/admin/change-credentials` | Update username/password (Hashed with HMAC-SHA256) | Auth Admin | - |
| **POST** | `/api/admin/toggle-model` | Globally enable or disable a model in the catalog | Auth Admin | - |
| **POST** | `/api/admin/flush-logs` | Delete recent proxy request audit trails | Auth Admin | - |

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

## Vision Modality (Multimodal)

OmniKey AI supports multimodal Vision inputs via both OpenAI and Gemini compatibility layers.

### 1. OpenAI Vision Format
* **Endpoint**: `POST /v1/chat/completions`
* **Full URLs**:
  * **Local**: `http://localhost:3001/v1/chat/completions`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1/chat/completions`
* **Auth**: `Authorization: Bearer omnikey-your-unified-openai-key-here`
* **Format**: Send the image inside the `content` array of a message block as a base64-encoded URL.
* **Header flag (Optional)**: `X-Required-Modality: vision` (The gateway auto-detects vision from payload if header is stripped).

#### Request Example:
```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Describe this image in detail." },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJR..."
          }
        }
      ]
    }
  ]
}
```

### 2. Gemini Vision Format
* **Endpoint**: `POST /v1beta/models/:model:generateContent?key=omnikey-g-your-key`
* **Full URLs**:
  * **Local**: `http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-key`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-key`
* **Format**: Send image as `inlineData` within the `parts` list of a contents turn.

#### Request Example:
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Describe this image in detail." },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "/9j/4AAQSkZJR..."
          }
        }
      ]
    }
  ]
}
```

---

## Voice (Speech Input & Transcription)

OmniKey AI supports speech recognition and transcription through two standard formats:

> [!IMPORTANT]
> **Functional Differences in Voice Formats**:
> * **OpenAI-Compatible Format (`/v1/audio/transcriptions`)**: Acts purely as a **transcription pipeline**. The gateway intercepts the upload and restricts the model (e.g. Gemini) via prompt formatting to output *verbatim text transcription only*, returning a simple `{"text": "..."}` JSON payload.
> * **Gemini-Compatible Format (`/v1beta/models/:model:generateContent`)**: Acts as a **multimodal speech-to-response interface**. Since audio is passed natively in the contents payload, the model uses its reasoning capabilities to comprehend the speech content and *generate a conversational response* matching the prompt request, rather than just transcribing the verbatim text.

### 1. OpenAI-Compatible Transcription Format
* **Endpoint**: `POST /v1/audio/transcriptions`
* **Full URLs**:
  * **Local**: `http://localhost:3001/v1/audio/transcriptions`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1/audio/transcriptions`
* **Auth**: `Authorization: Bearer omnikey-your-unified-openai-key-here`
* **Content-Type**: `multipart/form-data`
* **Modality Requirement**: `audio_input` (Automatically routed and enforced. Requires a personal Gemini key — promo tier blocked.)

#### Request Parameters

| Form Key | Type | Required | Description |
|---|---|---|---|
| `file` | File Binary | Yes | The audio file blob to transcribe (e.g. `.wav`, `.mp3`, `.m4a`, `.ogg`). |
| `model` | String | Yes | Target model ID (e.g. `gemini-2.5-flash` or `"auto"`). |

#### Success Response (`200 OK`)
```json
{
  "text": "Welcome to OmniKey AI. This is a transcribed audio stream."
}
```

### 2. Gemini-Compatible Speech Input (Multimodal Speech-to-Response)
Rather than a single-purpose transcription API, the Gemini format integrates audio natively as a multimodal part of general content generation. The model understands the speech input and responds to the content of the audio.

* **Endpoint**: `POST /v1beta/models/:model:generateContent?key=omnikey-g-your-key`
* **Full URLs**:
  * **Local**: `http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-key`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-key`
* **Format**: Send the audio file as base64-encoded `inlineData` inside a user part.
* **Header flag (Optional)**: `X-Required-Modality: audio_input`

#### Request Example:
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Describe this audio clip and answer any questions in it." },
        {
          "inlineData": {
            "mimeType": "audio/wav",
            "data": "UklGRi..."
          }
        }
      ]
    }
  ]
}
```

---

## Text-to-Speech (TTS) & Audio Output

OmniKey AI supports text-to-speech synthesis and spoken responses through two standard formats:

### 1. OpenAI-Compatible Synthesis Format
* **Endpoint**: `POST /v1/audio/speech`
* **Full URLs**:
  * **Local**: `http://localhost:3001/v1/audio/speech`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1/audio/speech`
* **Auth**: `Authorization: Bearer omnikey-your-unified-openai-key-here`
* **Content-Type**: `application/json`
* **Modality Requirement**: `audio_output` (Automatically routed and enforced. Requires a personal Gemini key — promo tier blocked.)

#### Request Payload Parameters
```json
{
  "model": "gemini-2.5-flash-preview-tts",
  "input": "Welcome to the OmniKey AI Developer Corner.",
  "voice": "alloy"
}
```

* **`model`**: Target model ID. Google-backed TTS models (such as `gemini-2.5-flash-preview-tts` or `gemini-2.5-flash`) must be used.
* **`input`**: Text string to synthesize (maximum 4000 characters).
* **`voice`**: OpenAI-compatible voice token. Maps to high-performance Gemini voices under-the-hood:
  * `alloy` $\rightarrow$ `Kore`
  * `echo` $\rightarrow$ `Fenrir`
  * `fable` $\rightarrow$ `Aoede`
  * `onyx` $\rightarrow$ `Charon`
  * `nova` $\rightarrow$ `Puck`
  * `shimmer` $\rightarrow$ `Aoede`

#### Response Format
* **Content-Type**: `audio/wav`
* **Payload**: Raw binary WAV data. The gateway automatically injects a valid 44-byte WAV container header onto Gemini's native raw PCM streams to ensure compatibility across all browsers and client audio players.

### 2. Gemini-Compatible Audio Output Format
You can request that Gemini model responses include synthesized spoken audio natively by requesting the `AUDIO` modality inside the generation config.

* **Endpoint**: `POST /v1beta/models/:model:generateContent?key=omnikey-g-your-key`
* **Full URLs**:
  * **Local**: `http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-key`
  * **Production**: `https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-key`
* **Format**: Pass `responseModalities: ["AUDIO"]` inside `generationConfig`. The proxy server automatically reroutes the query to a TTS-enabled model (`gemini-2.5-flash-preview-tts`) and returns base64 WAV-header-normalized audio.
* **Header flag (Optional)**: `X-Required-Modality: audio_output`

#### Request Example:
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "Who are you?" }]
    }
  ],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "Puck"
        }
      }
    }
  }
}
```

#### Success Response (`200 OK`)
Returns the model text response alongside the synthesized audio block inside candidate parts:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          { "text": "I am a helpful voice assistant built by Google." },
          {
            "inlineData": {
              "mimeType": "audio/wav",
              "data": "UklGRi..."
            }
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 25,
    "candidatesTokenCount": 85,
    "totalTokenCount": 110
  }
}
```

---

## Promo Tier Restrictions and Modalities

To prevent exhaustion of pooled admin resources, strict modality-based authorization checks are enforced inside the router's key iteration loops:

* **Modality Classes**: `vision`, `audio_input` (Voice), and `audio_output` (TTS) are flagged as specialized capabilities.
* **Key Exclusions**: When processing requests categorized under these modalities, the router **skips all administrative promo funding keys** unless the user has added their own personal Gemini/OpenAI key.
* **Rejection Error**: If a promo user attempts to invoke multimodal endpoints without adding a personal API key, the gateway returns a `403 Forbidden` response:
  ```json
  {
    "error": {
      "message": "Multimodal capabilities (Vision, Voice, TTS) are not available on the free promo tier. Please add your own Gemini API key under Keys page to use these features.",
      "status": 403
    }
  }
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

### 5. Client-Side Multi-Agent Orchestration (Debate Arena)
The frontend Debate Arena orchestrates multi-agent debates entirely on the client side using standard sequential calls to `/v1/chat/completions`. Under the hood, the client dynamically maps and sanitizes prompt arrays to satisfy strict provider requirements (e.g., merging consecutive identical roles into a single message, ensuring alternating `user`/`assistant` structures, and forcing the history list to end with a `user` role).

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

### Node.js (OpenAI SDK - Text Chat)
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'omnikey-your-unified-openai-key-here',
  // Local: 'http://localhost:3001/v1'
  // Production: 'https://omnikey-ai-unified-key-manager.onrender.com/v1'
  baseURL: 'http://localhost:3001/v1'
});

const chatCompletion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Explain APIs like I am five.' }],
  model: 'auto',
});

console.log(chatCompletion.choices[0].message.content);
```

### Node.js (OpenAI SDK - Text-to-Speech)
```javascript
import fetch from 'node-fetch';
import fs from 'fs';

// Local: 'http://localhost:3001/v1/audio/speech'
// Production: 'https://omnikey-ai-unified-key-manager.onrender.com/v1/audio/speech'
const response = await fetch('http://localhost:3001/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer omnikey-your-unified-openai-key-here'
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash-preview-tts',
    input: 'Hello, this is synthetic voice generated by OmniKey AI.',
    voice: 'nova'
  })
});

const buffer = await response.buffer();
fs.writeFileSync('speech.wav', buffer);
console.log('Audio file saved to speech.wav');
```

### Node.js (Google Gen AI SDK)
```javascript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: 'omnikey-g-your-unified-gemini-key-here',
  // Local: 'http://localhost:3001'
  // Production: 'https://omnikey-ai-unified-key-manager.onrender.com'
  baseUrl: 'http://localhost:3001'
});

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Explain APIs like I am five.',
});

console.log(response.text);
```

### cURL (OpenAI Compatible Text Chat)
```bash
# Local: http://localhost:3001/v1/chat/completions
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1/chat/completions
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer omnikey-your-unified-openai-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello world!"}]
  }'
```

### cURL (OpenAI Vision — Image Description)
```bash
# Local: http://localhost:3001/v1/chat/completions
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1/chat/completions
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer omnikey-your-unified-openai-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe this image."},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/4AAQ..."}}
      ]
    }]
  }'
```

### cURL (Gemini Vision — Image Description)
```bash
# Local: http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=...
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/gemini-2.5-flash:generateContent?key=...
curl -X POST "http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-unified-gemini-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {"text": "Describe this image."},
        {"inlineData": {"mimeType": "image/jpeg", "data": "/9j/4AAQ..."}}
      ]
    }]
  }'
```

### cURL (Speech-to-Text Audio Transcription)
```bash
# Local: http://localhost:3001/v1/audio/transcriptions
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1/audio/transcriptions
curl http://localhost:3001/v1/audio/transcriptions \
  -H "Authorization: Bearer omnikey-your-unified-openai-key-here" \
  -F "file=@/path/to/speech.wav" \
  -F "model=gemini-2.5-flash"
```

### cURL (Gemini Multimodal Speech Input)
```bash
# Local: http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=...
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/gemini-2.5-flash:generateContent?key=...
curl -X POST "http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-unified-gemini-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [
        {"text": "Transcribe and answer this audio prompt."},
        {"inlineData": {"mimeType": "audio/wav", "data": "UklGRi..."}}
      ]
    }]
  }'
```

### cURL (Gemini Audio Output Synthesis)
```bash
# Local: http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=...
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/gemini-2.5-flash:generateContent?key=...
curl -X POST "http://localhost:3001/v1beta/models/gemini-2.5-flash:generateContent?key=omnikey-g-your-unified-gemini-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "Hello! Explain quantum computing in one simple spoken sentence."}]
    }],
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Puck"
          }
        }
      }
    }
  }'
```

### cURL (Gemini Compatible Text Chat)
```bash
# Local: http://localhost:3001/v1beta/models/...:generateContent?key=...
# Production: https://omnikey-ai-unified-key-manager.onrender.com/v1beta/models/...:generateContent?key=...
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
