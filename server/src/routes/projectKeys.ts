import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb, getUnifiedApiKey, getUnifiedGeminiApiKey } from '../db/index.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { ProjectKey } from '../models/ProjectKey.js';
import { UserSettings } from '../models/UserSettings.js';

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
      const rows = db.prepare('SELECT * FROM project_keys ORDER BY created_at DESC').all() as any[];
      const keys = rows.map(r => ({
        id: r.id.toString(),
        name: r.name,
        projectKey: r.project_key,
        format: r.format,
        enabled: r.enabled === 1,
        isPromoted: r.is_promoted === 1,
        createdAt: r.created_at,
      }));
      return res.json(keys);
    } else {
      const rows = await ProjectKey.find({ userId: req.userId }).sort({ createdAt: -1 });
      const keys = rows.map(r => ({
        id: r._id.toString(),
        name: r.name,
        projectKey: r.projectKey,
        format: r.format,
        enabled: r.enabled,
        isPromoted: r.isPromoted,
        createdAt: r.createdAt.toISOString(),
      }));
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
