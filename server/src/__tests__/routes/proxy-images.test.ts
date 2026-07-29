import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb, getDb, getUnifiedApiKey, getUnifiedGeminiApiKey } from '../../db/index.js';

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

function authHeaders() {
  return { Authorization: `Bearer ${getUnifiedApiKey()}` };
}

describe('Image Generation Proxy', () => {
  let app: Express;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
  });

  beforeEach(async () => {
    const db = getDb();
    db.prepare('DELETE FROM api_keys').run();
    db.prepare('DELETE FROM requests').run();
    db.prepare("UPDATE models SET enabled = 1 WHERE model_id = 'imagen-3.0-generate-002'").run();
    db.prepare("UPDATE fallback_config SET enabled = 1 WHERE model_db_id IN (SELECT id FROM models WHERE model_id = 'imagen-3.0-generate-002')").run();

    // Add a Google API key
    const addKey = await request(app, 'POST', '/api/keys', {
      platform: 'google',
      key: 'AIzaSyGoogleKey_test',
      label: 'google-key',
    });
    expect(addKey.status).toBe(201);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /v1/images/generations returns a data URI when response_format is url', async () => {
    const origFetch = global.fetch;
    const payload = {
      generatedImages: [
        {
          image: {
            imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('imagen-3.0-generate-002:generateImages')) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(payload)),
          json: () => Promise.resolve(payload),
        } as any;
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/v1/images/generations', {
      prompt: 'a tiny red dot',
      model: 'imagen-3.0-generate-002',
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    }, authHeaders());

    expect(status).toBe(200);
    expect(body.data[0].url).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  });

  it('POST /v1/images/generations returns raw base64 when response_format is b64_json', async () => {
    const origFetch = global.fetch;
    const payload = {
      generatedImages: [
        {
          image: {
            imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('imagen-3.0-generate-002:generateImages')) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(payload)),
          json: () => Promise.resolve(payload),
        } as any;
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/v1/images/generations', {
      prompt: 'a tiny red dot',
      model: 'imagen-3.0-generate-002',
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }, authHeaders());

    expect(status).toBe(200);
    expect(body.data[0].b64_json).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  });

  it('POST /v1beta/models/:model:generateImages returns Native Gemini response', async () => {
    const origFetch = global.fetch;
    const payload = {
      generatedImages: [
        {
          image: {
            imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('imagen-3.0-generate-002:generateImages')) {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(payload)),
          json: () => Promise.resolve(payload),
        } as any;
      }
      return origFetch(url, init);
    });

    const token = getUnifiedGeminiApiKey();
    const { status, body } = await request(
      app,
      'POST',
      `/v1beta/models/imagen-3.0-generate-002:generateImages?key=${token}`,
      {
        prompt: 'a tiny red dot',
        numberOfImages: 1,
      }
    );

    expect(status).toBe(200);
    expect(body.generatedImages[0].image.imageBytes).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  });

  it('supports key retry fallbacks on image generation failures', async () => {
    // Add a second key via API endpoint
    const addKeyB = await request(app, 'POST', '/api/keys', {
      platform: 'google',
      key: 'AIzaSyGoogleKeyB_test',
      label: 'key-b',
    });
    expect(addKeyB.status).toBe(201);

    const origFetch = global.fetch;
    let attempt = 0;
    const successPayload = {
      generatedImages: [
        {
          image: {
            imageBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('imagen-3.0-generate-002:generateImages')) {
        attempt++;
        if (attempt === 1) {
          // First key fails with 429
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: () => Promise.resolve(JSON.stringify({ error: { message: 'Quota exceeded' } })),
            json: () => Promise.resolve({ error: { message: 'Quota exceeded' } }),
          } as any;
        } else {
          // Second key succeeds
          return {
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(successPayload)),
            json: () => Promise.resolve(successPayload),
          } as any;
        }
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/v1/images/generations', {
      prompt: 'a tiny red dot',
      model: 'imagen-3.0-generate-002',
    }, authHeaders());

    expect(status).toBe(200);
    expect(attempt).toBe(2);
    expect(body.data[0].url).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  });

  it('POST /v1/images/generations routes to Cloudflare and returns a data URI when model is flux-1-schnell', async () => {
    // Add a Cloudflare API key
    const addCFKey = await request(app, 'POST', '/api/keys', {
      platform: 'cloudflare',
      key: 'test-account-id:test-api-token',
      label: 'cf-key',
    });
    expect(addCFKey.status).toBe(201);

    const origFetch = global.fetch;
    const dummyArrayBuffer = new TextEncoder().encode('cloudflare-image-data').buffer;

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/ai/run/@cf/black-forest-labs/flux-1-schnell')) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name: string) => name.toLowerCase() === 'content-type' ? 'image/png' : null
          },
          arrayBuffer: () => Promise.resolve(dummyArrayBuffer),
        } as any;
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/v1/images/generations', {
      prompt: 'a futuristic city',
      model: 'flux-1-schnell',
      response_format: 'url',
    }, authHeaders());

    expect(status).toBe(200);
    expect(body.data[0].url).toContain('data:image/png;base64,Y2xvdWRmbGFyZS1pbWFnZS1kYXRh');
  });
});
