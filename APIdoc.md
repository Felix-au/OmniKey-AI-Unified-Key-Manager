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

All client requests to the proxy server must include the `Authorization` header containing your master unified API key.

### Master Key Format
Unified keys are generated automatically when database migrations run. They follow the format:
```text
omnikey-[32-byte-hex-string]
```

### Authorization Header
```http
Authorization: Bearer omnikey-your-unified-key-here
```

> [!WARNING]
> Requests without a valid `Authorization` header, or containing an incorrect key, will receive a `401 Unauthorized` response.

---

## Endpoints

| HTTP Method | Path | Description | Access |
|---|---|---|---|
| **POST** | `/v1/chat/completions` | Create a chat completion (OpenAI compatible) | Client |
| **GET** | `/v1/models` | List all supported models (OpenAI compatible) | Client |
| **GET** | `/api/keys` | Retrieve statuses and profiles of upstream keys | Dashboard |
| **POST** | `/api/keys` | Add or update an upstream provider key | Dashboard |
| **GET** | `/api/fallback-config` | Get the current fallback priority chain | Dashboard |
| **POST** | `/api/fallback-config` | Update the priority order of fallback providers | Dashboard |
| **GET** | `/api/stats/usage` | Fetch daily and monthly token consumption stats | Dashboard |

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

---

## Integration Examples

### Node.js (OpenAI SDK)
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'omnikey-your-unified-key-here',
  baseURL: 'http://localhost:3001/v1'
});

const chatCompletion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Explain APIs like I am five.' }],
  model: 'auto',
});

console.log(chatCompletion.choices[0].message.content);
```

### cURL
```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer omnikey-your-unified-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello world!"}]
  }'
```

---

<p align="center">
  <sub>Built for developers who want a single, smart API key for a billion free LLM tokens.</sub>
</p>
