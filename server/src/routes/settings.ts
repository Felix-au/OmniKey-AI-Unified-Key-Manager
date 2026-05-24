import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import { getUnifiedApiKey, regenerateUnifiedKey } from '../db/index.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { UserSettings } from '../models/UserSettings.js';

export const settingsRouter = Router();

// Apply Firebase dashboard authentication
settingsRouter.use(requireDashboardAuth);

// Get the unified API key
settingsRouter.get('/api-key', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      return res.json({ apiKey: getUnifiedApiKey() });
    } else {
      let userSettings = await UserSettings.findOne({ userId: req.userId });
      if (!userSettings) {
        // Auto-initialize settings with a fresh master API key for the cloud tenant
        userSettings = await UserSettings.create({
          userId: req.userId!,
          email: req.userEmail || 'user@example.com',
          unifiedApiKey: `omnikey-${crypto.randomBytes(24).toString('hex')}`
        });
      }
      return res.json({ apiKey: userSettings.unifiedApiKey });
    }
  } catch (err) {
    next(err);
  }
});

// Regenerate the unified API key
settingsRouter.post('/api-key/regenerate', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      const newKey = regenerateUnifiedKey();
      return res.json({ apiKey: newKey });
    } else {
      const newKey = `omnikey-${crypto.randomBytes(24).toString('hex')}`;
      const userSettings = await UserSettings.findOneAndUpdate(
        { userId: req.userId },
        { 
          unifiedApiKey: newKey,
          email: req.userEmail || 'user@example.com'
        },
        { new: true, upsert: true }
      );
      return res.json({ apiKey: userSettings.unifiedApiKey });
    }
  } catch (err) {
    next(err);
  }
});
