import { describe, it, expect, beforeAll } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb, getUnifiedGeminiApiKey } from '../../db/index.js';

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
});
