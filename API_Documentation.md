# OmniKey AI: Unified Key Manager — API Reference

> OmniKey AI exposes an OpenAI-compatible web API. Developers can point their client SDKs directly to the proxy server to query any of the 60+ integrated models. Below is the API reference detailing authentication, request formats, response structures, and client integrations.

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Chat Completions Request Format](#chat-completions-request-format)
- [Chat Completions Response Format](#chat-completions-response-format)
- [Streaming Completions](#streaming-completions)
- [Vision Modality (Multimodal)](#vision-modality-multimodal)
- [Speech-to-Text (STT) Transcription](#speech-to-text-stt-transcription)
- [Text-to-Speech (TTS) Synthesis](#text-to-speech-tts-synthesis)
- [Promo Tier Restrictions \& Modalities](#promo-tier-restrictions-and-modalities)
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

| HTTP Method | Path | Description | Access | Modality Code |
|---|---|---|---|---|
| **POST** | `/v1/chat/completions` | Create a chat completion (OpenAI compatible) | Client | `chat` |
| **POST** | `/v1/chat/completions` | Create a vision completion (OpenAI compatible) | Client | `vision` (auto-detected) |
| **POST** | `/v1/audio/transcriptions` | Transcribe audio files to text (STT) | Client | `audio_input` |
| **POST** | `/v1/audio/speech` | Synthesize text to speech (TTS) | Client | `audio_output` |
| **GET** | `/v1/models` | List all supported models (OpenAI compatible) | Client | - |
| **POST** | `/v1beta/models/:model:generateContent` | Generate a Gemini-compatible completion | Client | `chat` / `vision` |
| **POST** | `/v1beta/models/:model:streamGenerateContent` | Stream a Gemini-compatible completion | Client | `chat` / `vision` |
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

---

## Streaming Completions

If `"stream": true` is passed, the proxy response is sent as a `text/event-stream`. Each chunk follows this structure:

```text
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"auto","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"auto","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}]}

data: [DONE]
```

---

## Vision Modality (Multimodal)

OmniKey AI supports multimodal Vision inputs via both OpenAI and Gemini compatibility layers.

### 1. OpenAI Vision Format
* **Endpoint**: `POST /v1/chat/completions`
* **Format**: Send the image inside the `content` array of a message block as a base64-encoded URL.
* **Header flag (Optional)**: `X-Required-Modality: vision` (Note: The gateway automatically inspects the message payloads to detect vision modality if headers are stripped).

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
* **Endpoint**: `POST /v1beta/models/:model:generateContent?key=...`
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

## Speech-to-Text (STT) Transcription

The STT endpoint allows developers to transcribe audio files to text.

* **Endpoint**: `POST /v1/audio/transcriptions`
* **Content-Type**: `multipart/form-data`
* **Authorization**: Standard unified API key header (`Authorization: Bearer omnikey-...`)
* **Modality Requirement**: `audio_input` (Automatically routed and enforced)

### Request Parameters

| Form Key | Type | Required | Description |
|---|---|---|---|
| `file` | File Binary | Yes | The audio file blob to transcribe (e.g. `.wav`, `.mp3`, `.m4a`, `.ogg`). |
| `model` | String | Yes | Target model ID (e.g. `gemini-2.5-flash` or `"auto"`). |

### Success Response (`200 OK`)
```json
{
  "text": "Welcome to OmniKey AI. This is a transcribed audio stream."
}
```

---

## Text-to-Speech (TTS) Synthesis

The TTS endpoint allows developers to synthesize text input into high-quality speech output.

* **Endpoint**: `POST /v1/audio/speech`
* **Content-Type**: `application/json`
* **Authorization**: Standard unified API key header (`Authorization: Bearer omnikey-...`)
* **Modality Requirement**: `audio_output` (Automatically routed and enforced)

### Request Payload Parameters
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

### Response Format
* **Content-Type**: `audio/wav`
* **Payload**: Raw binary WAV data. The gateway automatically injects a valid 44-byte WAV container header onto Gemini's native raw PCM streams to ensure compatibility across all browsers and client audio players.

---

## Promo Tier Restrictions and Modalities

To prevent exhaustion of pooled admin resources, strict modality-based authorization checks are enforced inside the router's key iteration loops:

* **Modality Classes**: `vision`, `audio_input` (STT), and `audio_output` (TTS) are flagged as specialized capabilities.
* **Key Exclusions**: When processing requests categorized under these modalities, the router **skips all administrative promo funding keys** unless the user has added their own personal Gemini/OpenAI key.
* **Rejection Error**: If a promo user attempts to invoke multimodal endpoints without adding a personal API key, the gateway returns a `403 Forbidden` response:
  ```json
  {
    "error": {
      "message": "Multimodal capabilities (Vision, STT, TTS) are not available on the free promo tier. Please add your own Gemini API key under Keys page to use these features.",
      "status": 403
    }
  }
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

---

## Integration Examples

### Node.js (OpenAI SDK - Text Chat)
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

### Node.js (OpenAI SDK - Text-to-Speech)
```javascript
import fetch from 'node-fetch';
import fs from 'fs';

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

### cURL (Speech-to-Text Audio Transcription)
```bash
curl http://localhost:3001/v1/audio/transcriptions \
  -H "Authorization: Bearer omnikey-your-unified-openai-key-here" \
  -F "file=@/path/to/speech.wav" \
  -F "model=gemini-2.5-flash"
```

---

<p align="center">
  <sub>Built for developers who want a single, smart API key for high-performance AI routing.</sub>
</p>
