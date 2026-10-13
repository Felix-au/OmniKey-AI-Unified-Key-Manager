import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb, getDb } from '../../db/index.js';
import { ADMIN_SESSIONS } from '../../routes/admin.js';

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

describe('Admin Project Funding Cancellation API', () => {
  let app: Express;
  const testAdminToken = 'test-admin-secret-token-12345';
  let originalResendKey: string | undefined;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
    originalResendKey = process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (originalResendKey !== undefined) {
      process.env.RESEND_API_KEY = originalResendKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    ADMIN_SESSIONS.add(testAdminToken);
    const db = getDb();
    db.prepare('DELETE FROM promo_project_requests').run();
    db.prepare('DELETE FROM project_keys').run();
  });

  it('rejects cancellation without admin authentication (401)', async () => {
    const { status, body } = await request(app, 'POST', '/api/admin/project-funding/1/cancel', {});
    expect(status).toBe(401);
    expect(body.error.message).toContain('Unauthorized');
  });

  it('returns 404 when cancelling a non-existent funding request', async () => {
    const { status, body } = await request(
      app,
      'POST',
      '/api/admin/project-funding/99999/cancel',
      {},
      { Authorization: `Bearer ${testAdminToken}` }
    );
    expect(status).toBe(404);
    expect(body.error.message).toBe('Funding request not found');
  });

  it('cancels approved funding, reverts project key permissions, and skips email when sendEmail is false', async () => {
    const db = getDb();

    // Insert promoted project key
    const pkInfo = db.prepare(`
      INSERT INTO project_keys (name, project_key, format, enabled, is_promoted, allow_vision, allow_voice, allow_tts, allow_image_gen)
      VALUES (?, ?, ?, 1, 1, 1, 1, 1, 1)
    `).run('AI Assistant', 'omnikey-proj-testkey123', 'openai');
    const projectKeyId = pkInfo.lastInsertRowid.toString();

    // Insert approved promo request
    const reqInfo = db.prepare(`
      INSERT INTO promo_project_requests (
        user_id, user_email, project_key_id, project_name, project_key, format,
        project_link, status, pool_upgrade, allow_vision, allow_voice, allow_tts, allow_image_gen,
        approved_pool_upgrade, approved_allow_vision, approved_allow_voice, approved_allow_tts, approved_allow_image_gen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
    `).run('user-1', 'dev@example.com', projectKeyId, 'AI Assistant', 'omnikey-proj-testkey123', 'openai', 'https://example.com');
    const requestId = reqInfo.lastInsertRowid.toString();

    const { status, body } = await request(
      app,
      'POST',
      `/api/admin/project-funding/${requestId}/cancel`,
      { sendEmail: false },
      { Authorization: `Bearer ${testAdminToken}` }
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.emailSent).toBe(false);

    // Verify promo_project_requests record reverted
    const updatedReq = db.prepare('SELECT * FROM promo_project_requests WHERE id = ?').get(requestId) as any;
    expect(updatedReq.status).toBe('cancelled');
    expect(updatedReq.approved_pool_upgrade).toBe(0);
    expect(updatedReq.approved_allow_vision).toBe(0);
    expect(updatedReq.approved_allow_voice).toBe(0);
    expect(updatedReq.approved_allow_tts).toBe(0);
    expect(updatedReq.approved_allow_image_gen).toBe(0);

    // Verify project_keys permissions reverted
    const updatedKey = db.prepare('SELECT * FROM project_keys WHERE id = ?').get(projectKeyId) as any;
    expect(updatedKey.is_promoted).toBe(0);
    expect(updatedKey.allow_vision).toBe(0);
    expect(updatedKey.allow_voice).toBe(0);
    expect(updatedKey.allow_tts).toBe(0);
    expect(updatedKey.allow_image_gen).toBe(0);
  });

  it('cancels funding and dispatches customized email via Resend API when sendEmail is true', async () => {
    process.env.RESEND_API_KEY = 're_test_key_abc123';
    const db = getDb();

    const pkInfo = db.prepare(`
      INSERT INTO project_keys (name, project_key, format, enabled, is_promoted, allow_vision)
      VALUES (?, ?, ?, 1, 1, 1)
    `).run('VoiceBot', 'omnikey-proj-voicebot123', 'openai');
    const projectKeyId = pkInfo.lastInsertRowid.toString();

    const reqInfo = db.prepare(`
      INSERT INTO promo_project_requests (
        user_id, user_email, project_key_id, project_name, project_key, format,
        project_link, status, approved_pool_upgrade, approved_allow_vision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, 1)
    `).run('user-2', 'developer@company.org', projectKeyId, 'VoiceBot', 'omnikey-proj-voicebot123', 'openai', 'https://voicebot.org');
    const requestId = reqInfo.lastInsertRowid.toString();

    // Mock fetch for Resend API
    let resendCallPayload: any = null;
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockImplementation(async (url: any, opts: any) => {
      if (typeof url === 'string' && url.includes('api.resend.com/emails')) {
        resendCallPayload = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({ id: 'email_12345' }),
        };
      }
      return originalFetch(url, opts);
    });
    global.fetch = fetchMock;

    const { status, body } = await request(
      app,
      'POST',
      `/api/admin/project-funding/${requestId}/cancel`,
      {
        sendEmail: true,
        recipientEmail: 'custom-dev@company.org',
        subject: 'Important: Funding Revocation for VoiceBot',
        messageText: 'Custom admin notice: Activity exceeded threshold.\n\nPlease subscribe to tier 2.',
      },
      { Authorization: `Bearer ${testAdminToken}` }
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.emailSent).toBe(true);

    // Verify Resend payload was correctly dispatched with custom parameters
    expect(resendCallPayload).not.toBeNull();
    expect(resendCallPayload.from).toBe('OmniKey AI <omnikeyai@felixau.in>');
    expect(resendCallPayload.to).toBe('custom-dev@company.org');
    expect(resendCallPayload.subject).toBe('Important: Funding Revocation for VoiceBot');
    expect(resendCallPayload.html).toContain('Custom admin notice: Activity exceeded threshold.');
    expect(resendCallPayload.html).toContain('Please subscribe to tier 2.');
    expect(resendCallPayload.html).toContain('Project Funding Cancelled');
  });
});
