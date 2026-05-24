import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb, getDb } from '../../db/index.js';

async function request(app: Express, method: string, path: string, body?: any) {
  const server = app.listen(0);
  const addr = server.address() as any;
  const url = `http://127.0.0.1:${addr.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  server.close();
  return { status: res.status, body: data };
}

describe('Keys API', () => {
  let app: Express;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM api_keys').run();
  });

  it('GET /api/keys returns empty array initially', async () => {
    const { status, body } = await request(app, 'GET', '/api/keys');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('POST /api/keys creates a new key', async () => {
    const { status, body } = await request(app, 'POST', '/api/keys', {
      platform: 'groq',
      key: 'gsk_test123456789',
      label: 'My Groq Key',
    });

    expect(status).toBe(201);
    expect(body.platform).toBe('groq');
    expect(body.label).toBe('My Groq Key');
    expect(body.maskedKey).toContain('...');
  });

  it('GET /api/keys returns the created key', async () => {
    // First create a key
    await request(app, 'POST', '/api/keys', {
      platform: 'groq',
      key: 'gsk_test123456789',
    });

    const { status, body } = await request(app, 'GET', '/api/keys');
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].platform).toBe('groq');
  });

  it('POST /api/keys rejects invalid platform', async () => {
    const { status } = await request(app, 'POST', '/api/keys', {
      platform: 'invalid_platform',
      key: 'test',
    });
    expect(status).toBe(400);
  });

  it('POST /api/keys rejects missing key', async () => {
    const { status } = await request(app, 'POST', '/api/keys', {
      platform: 'groq',
    });
    expect(status).toBe(400);
  });

  it('DELETE /api/keys/:id removes a key', async () => {
    const { body: created } = await request(app, 'POST', '/api/keys', {
      platform: 'groq',
      key: 'gsk_test123456789',
    });

    const { status } = await request(app, 'DELETE', `/api/keys/${created.id}`);
    expect(status).toBe(200);

    const { body: after } = await request(app, 'GET', '/api/keys');
    expect(after).toHaveLength(0);
  });

  it('DELETE /api/keys/:id returns 404 for nonexistent key', async () => {
    const { status } = await request(app, 'DELETE', '/api/keys/99999');
    expect(status).toBe(404);
  });

  it('GET /api/keys/export returns keys as CSV', async () => {
    // Add two keys
    await request(app, 'POST', '/api/keys', { platform: 'groq', key: 'gsk_test123', label: 'Label A' });
    await request(app, 'POST', '/api/keys', { platform: 'google', key: 'google_test456', label: 'Label B' });

    const server = app.listen(0);
    const addr = server.address() as any;
    const url = `http://127.0.0.1:${addr.port}/api/keys/export`;
    const res = await fetch(url);
    const text = await res.text();
    server.close();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(text).toContain('platform,key,label');
    expect(text).toContain('groq,gsk_test123,Label A');
    expect(text).toContain('google,google_test456,Label B');
  });

  it('POST /api/keys/import imports keys from CSV', async () => {
    const csvText = 'platform,key,label\nmistral,mistral_key_abc,Label C\ncerebras,cerebras_key_xyz,Label D\ninvalid_platform,some_key,Label E\n';
    const { status, body } = await request(app, 'POST', '/api/keys/import', { csvText });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(2); // Skip invalid_platform

    const { body: keysList } = await request(app, 'GET', '/api/keys');
    expect(keysList).toHaveLength(2);
    expect(keysList.map((k: any) => k.platform).sort()).toEqual(['cerebras', 'mistral']);
    expect(keysList.map((k: any) => k.label).sort()).toEqual(['Label C', 'Label D']);
  });
});
