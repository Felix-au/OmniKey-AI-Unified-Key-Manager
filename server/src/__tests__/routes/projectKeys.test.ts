import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb, getDb } from '../../db/index.js';

async function request(app: Express, method: string, path: string, body?: any, headers: Record<string, string> = {}) {
  const server = app.listen(0);
  const addr = server.address() as any;
  const url = `http://127.0.0.1:${addr.port}${path}`;

  const res = await fetch(url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  server.close();
  return { status: res.status, body: data };
}

describe('Project Keys API', () => {
  let app: Express;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM project_keys').run();
  });

  it('GET /api/project-keys returns empty array initially', async () => {
    const { status, body } = await request(app, 'GET', '/api/project-keys');
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('POST /api/project-keys creates a new project key', async () => {
    const { status, body } = await request(app, 'POST', '/api/project-keys', {
      name: 'Slack Bot',
      format: 'openai',
      projectLink: 'https://example.com',
    });

    expect(status).toBe(201);
    expect(body.name).toBe('Slack Bot');
    expect(body.format).toBe('openai');
    expect(body.projectKey).toContain('omnikey-proj-');
    expect(body.enabled).toBe(true);
    expect(body.isPromoted).toBe(false);
  });

  it('GET /api/project-keys returns the created project key', async () => {
    await request(app, 'POST', '/api/project-keys', {
      name: 'Slack Bot',
      format: 'openai',
      projectLink: 'https://example.com',
    });

    const { status, body } = await request(app, 'GET', '/api/project-keys');
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Slack Bot');
    expect(body[0].format).toBe('openai');
  });

  it('POST /api/project-keys/promote promotes the default key', async () => {
    const { status, body } = await request(app, 'POST', '/api/project-keys/promote', {
      name: 'Promoted Key',
      format: 'openai',
      projectLink: 'https://example.com',
    });

    expect(status).toBe(201);
    expect(body.name).toBe('Promoted Key');
    expect(body.format).toBe('openai');
    expect(body.isPromoted).toBe(true);
    expect(body.projectKey).toContain('omnikey-');
  });

  it('PATCH /api/project-keys/:id toggles key status', async () => {
    const { body: created } = await request(app, 'POST', '/api/project-keys', {
      name: 'Test Key',
      format: 'gemini',
      projectLink: 'https://example.com',
    });

    const { status, body } = await request(app, 'PATCH', `/api/project-keys/${created.id}`, {
      enabled: false,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.enabled).toBe(false);

    const { body: keysList } = await request(app, 'GET', '/api/project-keys');
    expect(keysList[0].enabled).toBe(false);
  });

  it('DELETE /api/project-keys/:id removes the key', async () => {
    const { body: created } = await request(app, 'POST', '/api/project-keys', {
      name: 'Delete Me',
      format: 'openai',
      projectLink: 'https://example.com',
    });

    const { status } = await request(app, 'DELETE', `/api/project-keys/${created.id}`);
    expect(status).toBe(200);

    const { body: keysList } = await request(app, 'GET', '/api/project-keys');
    expect(keysList).toHaveLength(0);
  });

  it('proxy authentication with custom project key bypassing 401', async () => {
    const { body: keyObj } = await request(app, 'POST', '/api/project-keys', {
      name: 'Slack Integration Key',
      format: 'openai',
      projectLink: 'https://example.com',
    });
    expect(keyObj.projectKey).toContain('omnikey-proj-');

    const { status } = await request(
      app,
      'POST',
      '/v1/chat/completions',
      {
        model: 'auto',
        messages: [{ role: 'user', content: 'test message' }]
      },
      {
        'Authorization': `Bearer ${keyObj.projectKey}`
      }
    );

    expect(status).not.toBe(401);
  });

  it('proxy authentication rejects disabled project key with 401', async () => {
    const { body: keyObj } = await request(app, 'POST', '/api/project-keys', {
      name: 'Disabled Key',
      format: 'openai',
      projectLink: 'https://example.com',
    });

    await request(app, 'PATCH', `/api/project-keys/${keyObj.id}`, {
      enabled: false,
    });

    const { status } = await request(
      app,
      'POST',
      '/v1/chat/completions',
      {
        model: 'auto',
        messages: [{ role: 'user', content: 'test message' }]
      },
      {
        'Authorization': `Bearer ${keyObj.projectKey}`
      }
    );

    expect(status).toBe(401);
  });
});
