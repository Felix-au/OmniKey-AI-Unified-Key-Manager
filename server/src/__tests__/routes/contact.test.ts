import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';

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

describe('Contact API', () => {
  let app: Express;
  let originalApiKey: string | undefined;

  beforeAll(() => {
    originalApiKey = process.env.RESEND_API_KEY;
    app = createApp();
  });

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key_12345';
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('POST /api/contact fails if name is missing or empty', async () => {
    const { status, body } = await request(app, 'POST', '/api/contact', {
      email: 'user@example.com',
      message: 'Hello developer!',
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Name is required');
  });

  it('POST /api/contact fails if email is invalid', async () => {
    const { status, body } = await request(app, 'POST', '/api/contact', {
      name: 'Felix',
      email: 'invalid-email',
      message: 'Hello developer!',
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Valid email is required');
  });

  it('POST /api/contact fails if message is missing', async () => {
    const { status, body } = await request(app, 'POST', '/api/contact', {
      name: 'Felix',
      email: 'user@example.com',
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Message is required');
  });

  it('POST /api/contact fails if RESEND_API_KEY is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const { status, body } = await request(app, 'POST', '/api/contact', {
      name: 'Felix',
      email: 'user@example.com',
      message: 'Hello developer!',
    });
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Mail configuration error');
  });

  it('POST /api/contact successfully sends both emails', async () => {
    const origFetch = global.fetch;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (typeof url === 'string' && url.includes('api.resend.com/emails')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'email_id_123' }),
        } as any;
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/api/contact', {
      name: 'Felix',
      email: 'user@example.com',
      message: 'Hello developer!',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Message dispatched successfully');

    // Should have sent two emails to Resend, plus 1 call for the request function
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Check parameters of first Resend call (which is the second call overall since request is first)
    const firstCallArgs = fetchSpy.mock.calls[1];
    expect(firstCallArgs[0]).toBe('https://api.resend.com/emails');
    const firstBody = JSON.parse(firstCallArgs[1]?.body as string);
    expect(firstBody.from).toBe('OmniKey AI <omnikeyai@felixau.in>');
    expect(firstBody.to).toBe('felixaugum@gmail.com');
    expect(firstBody.reply_to).toBe('user@example.com');
    expect(firstBody.subject).toContain('New Inquiry from Felix');

    // Check parameters of second Resend call (which is the third call overall)
    const secondCallArgs = fetchSpy.mock.calls[2];
    expect(secondCallArgs[0]).toBe('https://api.resend.com/emails');
    const secondBody = JSON.parse(secondCallArgs[1]?.body as string);
    expect(secondBody.from).toBe('OmniKey AI Support <omnikeyai@felixau.in>');
    expect(secondBody.to).toBe('user@example.com');
    expect(secondBody.reply_to).toBe('omnikeyai@felixau.in');
    expect(secondBody.subject).toContain('We received your message');
  });

  it('POST /api/contact aborts if the developer notification email fails to dispatch', async () => {
    const origFetch = global.fetch;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (typeof url === 'string' && url.includes('api.resend.com/emails')) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ message: 'Invalid API key or domain unauthorized' }),
        } as any;
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/api/contact', {
      name: 'Felix',
      email: 'user@example.com',
      message: 'Hello developer!',
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Invalid API key or domain unauthorized');
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 for request, 1 for failed developer email
  });

  it('POST /api/contact succeeds even if the user confirmation copy email fails to dispatch', async () => {
    let callCount = 0;
    const origFetch = global.fetch;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (typeof url === 'string' && url.includes('api.resend.com/emails')) {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'email_id_123' }),
          } as any;
        } else {
          return {
            ok: false,
            status: 400,
            json: async () => ({ message: 'Sender inbox full' }),
          } as any;
        }
      }
      return origFetch(url, init);
    });

    const { status, body } = await request(app, 'POST', '/api/contact', {
      name: 'Felix',
      email: 'user@example.com',
      message: 'Hello developer!',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Message dispatched successfully');
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 for request, 2 for emails
  });
});
