import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb, getUnifiedApiKey, getUnifiedGeminiApiKey } from '../db/index.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { ProjectKey } from '../models/ProjectKey.js';
import { UserSettings } from '../models/UserSettings.js';
import { RequestLog } from '../models/RequestLog.js';
import { PromoProjectRequest } from '../models/PromoProjectRequest.js';

export const projectKeysRouter = Router();

// Secure all endpoints with dashboard auth
projectKeysRouter.use(requireDashboardAuth);

const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  format: z.enum(['openai', 'gemini']),
  projectLink: z.string().url('Project link must be a valid URL'),
});

// List all project keys
projectKeysRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();
      const query = `
        SELECT 
          pk.id,
          pk.name,
          pk.project_key,
          pk.format,
          pk.enabled,
          pk.is_promoted,
          pk.project_link,
          pk.created_at,
          COUNT(r.id) as total_requests,
          SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as success_requests,
          SUM(IFNULL(r.input_tokens, 0) + IFNULL(r.output_tokens, 0)) as total_tokens,
          AVG(r.latency_ms) as avg_latency,
          MAX(r.created_at) as last_used_at
        FROM project_keys pk
        LEFT JOIN requests r ON r.project_key = pk.project_key
        GROUP BY pk.id
        ORDER BY pk.created_at DESC
      `;
      const rows = db.prepare(query).all() as any[];
      const keys = rows.map(r => {
        const totalRequests = r.total_requests ?? 0;
        const successRequests = r.success_requests ?? 0;
        const successRate = totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100 * 10) / 10 : 0;
        return {
          id: r.id.toString(),
          name: r.name,
          projectKey: r.project_key,
          format: r.format,
          enabled: r.enabled === 1,
          isPromoted: r.is_promoted === 1,
          projectLink: r.project_link || '',
          createdAt: r.created_at,
          metrics: {
            totalRequests,
            successRate,
            totalTokens: r.total_tokens ?? 0,
            avgLatencyMs: Math.round(r.avg_latency ?? 0),
            lastUsedAt: r.last_used_at || null,
          }
        };
      });
      return res.json(keys);
    } else {
      const rows = await ProjectKey.find({ userId: req.userId }).sort({ createdAt: -1 });
      const keys = [];
      for (const r of rows) {
        const stats = await RequestLog.aggregate([
          { $match: { projectKey: r.projectKey } },
          {
            $group: {
              _id: null,
              totalRequests: { $sum: 1 },
              successRequests: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
              totalTokens: { $sum: { $add: [{ $ifNull: ['$inputTokens', 0] }, { $ifNull: ['$outputTokens', 0] }] } },
              avgLatency: { $avg: '$latencyMs' },
              lastUsedAt: { $max: '$createdAt' }
            }
          }
        ]);
        const s = stats[0] || {
          totalRequests: 0,
          successRequests: 0,
          totalTokens: 0,
          avgLatency: 0,
          lastUsedAt: null
        };
        const totalRequests = s.totalRequests ?? 0;
        const successRequests = s.successRequests ?? 0;
        const successRate = totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100 * 10) / 10 : 0;

        keys.push({
          id: r._id.toString(),
          name: r.name,
          projectKey: r.projectKey,
          format: r.format,
          enabled: r.enabled,
          isPromoted: r.isPromoted,
          projectLink: r.projectLink || '',
          createdAt: r.createdAt.toISOString(),
          metrics: {
            totalRequests,
            successRate,
            totalTokens: s.totalTokens ?? 0,
            avgLatencyMs: Math.round(s.avgLatency ?? 0),
            lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
          }
        });
      }
      return res.json(keys);
    }
  } catch (err) {
    next(err);
  }
});

// Create a new custom project key
projectKeysRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', ') } });
      return;
    }

    const { name, format, projectLink } = parsed.data;
    const tokenBytes = crypto.randomBytes(24).toString('hex');
    const key = format === 'openai' ? `omnikey-proj-${tokenBytes}` : `omnikey-g-proj-${tokenBytes}`;

    if (isLocalDbEnabled()) {
      const db = getDb();
      const result = db.prepare(`
        INSERT INTO project_keys (name, project_key, format, enabled, is_promoted, project_link)
        VALUES (?, ?, ?, 1, 0, ?)
      `).run(name, key, format, projectLink);

      return res.status(201).json({
        id: result.lastInsertRowid.toString(),
        name,
        projectKey: key,
        format,
        enabled: true,
        isPromoted: false,
        projectLink,
      });
    } else {
      const result = await ProjectKey.create({
        userId: req.userId!,
        name,
        projectKey: key,
        format,
        enabled: true,
        isPromoted: false,
        projectLink,
      });

      return res.status(201).json({
        id: result._id.toString(),
        name,
        projectKey: key,
        format,
        enabled: true,
        isPromoted: false,
        projectLink,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Promote a default key
projectKeysRouter.post('/promote', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', ') } });
      return;
    }

    const { name, format, projectLink } = parsed.data;
    let defaultKey = '';

    if (isLocalDbEnabled()) {
      defaultKey = format === 'openai' ? getUnifiedApiKey() : getUnifiedGeminiApiKey();
    } else {
      const settings = await UserSettings.findOne({ userId: req.userId! });
      if (!settings) {
        res.status(400).json({ error: { message: 'Default keys are not initialized yet.' } });
        return;
      }
      defaultKey = format === 'openai' ? settings.unifiedApiKey : (settings.unifiedGeminiApiKey ?? '');
    }

    if (!defaultKey) {
      res.status(400).json({ error: { message: 'Unified default key could not be resolved.' } });
      return;
    }

    // Check duplicate promotion
    if (isLocalDbEnabled()) {
      const db = getDb();
      const duplicate = db.prepare('SELECT id FROM project_keys WHERE project_key = ?').get(defaultKey);
      if (duplicate) {
        res.status(400).json({ error: { message: 'This default unified key has already been promoted as a project key.' } });
        return;
      }

      const result = db.prepare(`
        INSERT INTO project_keys (name, project_key, format, enabled, is_promoted, project_link)
        VALUES (?, ?, ?, 1, 1, ?)
      `).run(name, defaultKey, format, projectLink);

      return res.status(201).json({
        id: result.lastInsertRowid.toString(),
        name,
        projectKey: defaultKey,
        format,
        enabled: true,
        isPromoted: true,
        projectLink,
      });
    } else {
      const duplicate = await ProjectKey.findOne({ projectKey: defaultKey, userId: req.userId! });
      if (duplicate) {
        res.status(400).json({ error: { message: 'This default unified key has already been promoted as a project key.' } });
        return;
      }

      const result = await ProjectKey.create({
        userId: req.userId!,
        name,
        projectKey: defaultKey,
        format,
        enabled: true,
        isPromoted: true,
        projectLink,
      });

      return res.status(201).json({
        id: result._id.toString(),
        name,
        projectKey: defaultKey,
        format,
        enabled: true,
        isPromoted: true,
        projectLink,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Toggle project key enable/disable status
projectKeysRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { enabled, projectLink } = req.body;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      res.status(400).json({ error: { message: 'enabled must be a boolean' } });
      return;
    }

    if (projectLink !== undefined) {
      try {
        const url = new URL(projectLink);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error();
        }
      } catch (_) {
        res.status(400).json({ error: { message: 'Project link must be a valid HTTP or HTTPS URL' } });
        return;
      }
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      if (enabled !== undefined && projectLink !== undefined) {
        db.prepare('UPDATE project_keys SET enabled = ?, project_link = ? WHERE id = ?').run(enabled ? 1 : 0, projectLink, id);
      } else if (enabled !== undefined) {
        db.prepare('UPDATE project_keys SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
      } else if (projectLink !== undefined) {
        db.prepare('UPDATE project_keys SET project_link = ? WHERE id = ?').run(projectLink, id);
      }
      return res.json({ success: true, enabled, projectLink });
    } else {
      const updateDoc: any = {};
      if (enabled !== undefined) updateDoc.enabled = enabled;
      if (projectLink !== undefined) updateDoc.projectLink = projectLink;

      const result = await ProjectKey.findOneAndUpdate(
        { _id: id, userId: req.userId! },
        updateDoc,
        { new: true }
      );
      if (!result) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      return res.json({ success: true, enabled: result.enabled, projectLink: result.projectLink });
    }
  } catch (err) {
    next(err);
  }
});

// Delete a project key
projectKeysRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    if (isLocalDbEnabled()) {
      const db = getDb();
      const result = db.prepare('DELETE FROM project_keys WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      return res.json({ success: true });
    } else {
      const result = await ProjectKey.deleteOne({ _id: id, userId: req.userId! });
      if (result.deletedCount === 0) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      return res.json({ success: true });
    }
  } catch (err) {
    next(err);
  }
});

// Request project funding (promo pool upgrade)
const fundRequestSchema = z.object({
  projectKeyId: z.string().min(1, 'Project key is required'),
  projectLink: z.string().min(1, 'Project link is required'),
  remarks: z.string().optional(),
});

projectKeysRouter.post('/fund-request', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parsed = fundRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', ') } });
      return;
    }

    const { projectKeyId, projectLink, remarks = '' } = parsed.data;
    const userId = req.userId!;
    const userEmail = req.userEmail || 'user@example.com';

    let projectName = '';
    let projectKey = '';
    let format: 'openai' | 'gemini' = 'openai';

    // 1. Fetch details of the project key to verify ownership
    if (isLocalDbEnabled()) {
      const db = getDb();
      const row = db.prepare('SELECT name, project_key, format FROM project_keys WHERE id = ?').get(projectKeyId) as any;
      if (!row) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      projectName = row.name;
      projectKey = row.project_key;
      format = row.format;
    } else {
      const pkObj = await ProjectKey.findOne({ _id: projectKeyId, userId });
      if (!pkObj) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      projectName = pkObj.name;
      projectKey = pkObj.projectKey;
      format = pkObj.format;
    }

    // 2. Save request to database
    let insertedId = '';
    if (isLocalDbEnabled()) {
      const db = getDb();
      const result = db.prepare(`
        INSERT INTO promo_project_requests (user_id, user_email, project_key_id, project_name, project_key, format, project_link, remarks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(userId, userEmail, projectKeyId, projectName, projectKey, format, projectLink, remarks);
      insertedId = result.lastInsertRowid.toString();
    } else {
      const reqObj = await PromoProjectRequest.create({
        userId,
        userEmail,
        projectKeyId,
        projectName,
        projectKey,
        format,
        projectLink,
        remarks,
        status: 'pending'
      });
      insertedId = reqObj._id.toString();
    }

    // 3. Send email to felixaugum@gmail.com
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const maskedKey = projectKey.slice(0, 15) + '•'.repeat(24);
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "OmniKey AI <omneykeyai@felix-au.me>",
            to: "felixaugum@gmail.com",
            reply_to: userEmail,
            subject: `OmniKey AI: Project Funding Request from ${userEmail}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
                  <h2 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700; tracking: -0.025em;">Project Funding Request Received</h2>
                  <p style="color: #6b7280; margin: 6px 0 0 0; font-size: 14px;">OmniKey AI - Developer Portal</p>
                </div>
                <div style="margin-bottom: 28px; line-height: 1.6; font-size: 15px;">
                  <p style="margin: 0 0 10px 0;"><strong style="color: #4b5563;">User:</strong> ${userEmail}</p>
                  <p style="margin: 0 0 10px 0;"><strong style="color: #4b5563;">Project Name:</strong> ${projectName}</p>
                  <p style="margin: 0 0 10px 0;"><strong style="color: #4b5563;">Key Format:</strong> ${format}</p>
                  <p style="margin: 0 0 10px 0;"><strong style="color: #4b5563;">Project Key:</strong> <code style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${maskedKey}</code></p>
                  <p style="margin: 0 0 10px 0;"><strong style="color: #4b5563;">Project Link:</strong> <a href="${projectLink}" target="_blank" style="color: #7c3aed; text-decoration: none; font-weight: 500;">${projectLink}</a></p>
                  <div style="background-color: #f9fafb; border-left: 4px solid #7c3aed; padding: 20px; border-radius: 8px; margin-top: 16px;">
                    <p style="margin: 0; font-weight: 600; color: #4b5563; margin-bottom: 6px;">User Remarks:</p>
                    <p style="margin: 0; font-style: italic; color: #374151; white-space: pre-line;">"${remarks || 'No remarks provided.'}"</p>
                  </div>
                </div>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0; line-height: 1.5;">This email was securely routed from the OmniKey AI project funding form.<br/>Log into the admin panel to approve or reject this request.</p>
              </div>
            `,
          }),
        });
      } catch (err: any) {
        console.error("[Email] Failed to dispatch admin notification email:", err.message || err);
      }
    } else {
      console.warn("[Email] RESEND_API_KEY is not configured. Skipping admin notification email.");
    }

    return res.status(201).json({
      success: true,
      id: insertedId,
      projectName,
      projectLink,
      status: 'pending'
    });
  } catch (err) {
    next(err);
  }
});

// List all promo project requests for the logged-in user
projectKeysRouter.get('/fund-requests', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare('SELECT id, project_key_id, project_name, project_link, remarks, status, created_at FROM promo_project_requests WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
      const requests = rows.map(r => ({
        id: r.id.toString(),
        projectKeyId: r.project_key_id,
        projectName: r.project_name,
        projectLink: r.project_link,
        remarks: r.remarks,
        status: r.status,
        createdAt: r.created_at
      }));
      return res.json(requests);
    } else {
      const rows = await PromoProjectRequest.find({ userId }).sort({ createdAt: -1 });
      const requests = rows.map(r => ({
        id: r._id.toString(),
        projectKeyId: r.projectKeyId,
        projectName: r.projectName,
        projectLink: r.projectLink,
        remarks: r.remarks,
        status: r.status,
        createdAt: r.createdAt.toISOString()
      }));
      return res.json(requests);
    }
  } catch (err) {
    next(err);
  }
});
