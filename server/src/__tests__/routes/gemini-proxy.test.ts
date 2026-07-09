import { describe, it, expect, beforeAll } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb, getUnifiedGeminiApiKey } from '../../db/index.js';
import {
  translateGeminiRequest,
  translateToGeminiResponse,
  translateToGeminiStreamChunk
} from '../../routes/gemini-proxy.js';

async function request(app: Express, method: string, path: string, body?: any, headers: Record<string, string> = {}) {
  const server = app.listen(0);
  const addr = server.address() as any;
  const url = `http://127.0.0.1:${addr.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.text();
  server.close();

  let json: any = null;
  try { json = JSON.parse(data); } catch {}

  return { status: res.status, body: json, headers: res.headers, raw: data };
}

describe('Gemini proxy router', () => {
  let app: Express;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
  });

  it('lists models without requiring an API key', async () => {
    const { status, body } = await request(app, 'GET', '/v1beta/models');
    expect(status).toBe(200);
    expect(body.models).toBeDefined();
    expect(body.models[0].name).toBe('models/auto');
  });

  it('retrieves details for models/auto', async () => {
    const { status, body } = await request(app, 'GET', '/v1beta/models/auto');
    expect(status).toBe(200);
    expect(body.name).toBe('models/auto');
  });

  it('retrieves details for models/nvidia/llama-3.1-70b-instruct', async () => {
    const { status, body } = await request(app, 'GET', '/v1beta/models/nvidia/llama-3.1-70b-instruct');
    expect(status).toBe(404);
    expect(body.error.message).toContain("nvidia/llama-3.1-70b-instruct");
  });

  it('rejects post generateContent with missing API key', async () => {
    const { status, body } = await request(app, 'POST', '/v1beta/models/auto:generateContent', {
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe(401);
    expect(body.error.status).toBe('UNAUTHENTICATED');
  });

  it('rejects post generateContent with invalid API key', async () => {
    const { status, body } = await request(app, 'POST', '/v1beta/models/auto:generateContent?key=invalid-key', {
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
    });
    expect(status).toBe(401);
  });

  it('accepts query param key of the unified gemini key format', async () => {
    const geminiKey = getUnifiedGeminiApiKey();
    const { status } = await request(app, 'POST', `/v1beta/models/auto:generateContent?key=${geminiKey}`, {
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
    });
    // Authentication succeeded, but no functional keys are configured in this test db context.
    // So the server returns a 503 / 429 rather than a 401.
    expect(status).not.toBe(401);
  });

  it('accepts headers token format as well', async () => {
    const geminiKey = getUnifiedGeminiApiKey();
    const { status } = await request(app, 'POST', '/v1beta/models/auto:generateContent', {
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
    }, {
      'x-goog-api-key': geminiKey
    });
    expect(status).not.toBe(401);
  });

  describe('Audio and Modalities Translation Helpers', () => {
    it('translates generationConfig responseModalities and speechConfig', () => {
      const body = {
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck'
              }
            }
          }
        }
      };
      const result = translateGeminiRequest(body);
      expect(result.responseModalities).toEqual(['AUDIO']);
      expect(result.speechConfig).toBeDefined();
      expect((result.speechConfig as any).voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck');
    });

    it('translates output base64 audio response to Gemini format', () => {
      const mockOpenaiResult = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Spoken text' },
                {
                  type: 'inline_data',
                  inlineData: {
                    mimeType: 'audio/mp3',
                    data: 'base64audiobytes'
                  }
                }
              ]
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };
      const result = translateToGeminiResponse(mockOpenaiResult, 'gemini-2.5-flash');
      expect(result.candidates[0].content.parts.length).toBe(2);
      expect(result.candidates[0].content.parts[0].text).toBe('Spoken text');
      expect(result.candidates[0].content.parts[1].inlineData.mimeType).toBe('audio/mp3');
      expect(result.candidates[0].content.parts[1].inlineData.data).toBe('base64audiobytes');
    });

    it('translates output stream base64 audio chunk to Gemini format', () => {
      const mockOpenaiChunk = {
        choices: [
          {
            index: 0,
            delta: {
              content: '',
              inline_data: [
                {
                  mimeType: 'audio/wav',
                  data: 'chunkbase64'
                }
              ]
            },
            finish_reason: null
          }
        ]
      };
      const result = translateToGeminiStreamChunk(mockOpenaiChunk);
      expect(result.candidates[0].content.parts.length).toBe(1);
      expect(result.candidates[0].content.parts[0].inlineData.mimeType).toBe('audio/wav');
      expect(result.candidates[0].content.parts[0].inlineData.data).toBe('chunkbase64');
    });
  });

  it('rejects explicit groq/compound-mini generateContent with 400 when input tokens exceed 8192', async () => {
    const geminiKey = getUnifiedGeminiApiKey();
    const longPrompt = 'a'.repeat(33000);
    const { status, body } = await request(app, 'POST', `/v1beta/models/groq/compound-mini:generateContent?key=${geminiKey}`, {
      contents: [{ role: 'user', parts: [{ text: longPrompt }] }]
    });

    expect(status).toBe(400);
    expect(body.error.message).toContain('only supports 8192 tokens and the input token is higher than 8192');
    expect(body.error.status).toBe('INVALID_ARGUMENT');
  });
});
