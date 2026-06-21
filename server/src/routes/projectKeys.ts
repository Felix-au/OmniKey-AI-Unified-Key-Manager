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

export const projectKeysRouter = Router();

// Secure all endpoints with dashboard auth
projectKeysRouter.use(requireDashboardAuth);

const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  format: z.enum(['openai', 'gemini']),
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

    const { name, format } = parsed.data;
    const tokenBytes = crypto.randomBytes(24).toString('hex');
    const key = format === 'openai' ? `omnikey-proj-${tokenBytes}` : `omnikey-g-proj-${tokenBytes}`;

    if (isLocalDbEnabled()) {
      const db = getDb();
      const result = db.prepare(`
        INSERT INTO project_keys (name, project_key, format, enabled, is_promoted)
        VALUES (?, ?, ?, 1, 0)
      `).run(name, key, format);

      return res.status(201).json({
        id: result.lastInsertRowid.toString(),
        name,
        projectKey: key,
        format,
        enabled: true,
        isPromoted: false,
      });
    } else {
      const result = await ProjectKey.create({
        userId: req.userId!,
        name,
        projectKey: key,
        format,
        enabled: true,
        isPromoted: false,
      });

      return res.status(201).json({
        id: result._id.toString(),
        name,
        projectKey: key,
        format,
        enabled: true,
        isPromoted: false,
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

    const { name, format } = parsed.data;
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
        INSERT INTO project_keys (name, project_key, format, enabled, is_promoted)
        VALUES (?, ?, ?, 1, 1)
      `).run(name, defaultKey, format);

      return res.status(201).json({
        id: result.lastInsertRowid.toString(),
        name,
        projectKey: defaultKey,
        format,
        enabled: true,
        isPromoted: true,
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
      });

      return res.status(201).json({
        id: result._id.toString(),
        name,
        projectKey: defaultKey,
        format,
        enabled: true,
        isPromoted: true,
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
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: { message: 'enabled must be a boolean' } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      const result = db.prepare('UPDATE project_keys SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
      if (result.changes === 0) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      return res.json({ success: true, enabled });
    } else {
      const result = await ProjectKey.findOneAndUpdate(
        { _id: id, userId: req.userId! },
        { enabled },
        { new: true }
      );
      if (!result) {
        res.status(404).json({ error: { message: 'Project key not found.' } });
        return;
      }
      return res.json({ success: true, enabled: result.enabled });
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
