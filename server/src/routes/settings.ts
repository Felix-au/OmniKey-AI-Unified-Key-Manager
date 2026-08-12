import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import { getUnifiedApiKey, regenerateUnifiedKey, getUnifiedGeminiApiKey, regenerateUnifiedGeminiKey } from '../db/index.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { UserSettings } from '../models/UserSettings.js';
import { PromoUser } from '../models/PromoUser.js';

export const settingsRouter = Router();

// Apply Firebase dashboard authentication
settingsRouter.use(requireDashboardAuth);

// Get the unified API key
settingsRouter.get('/api-key', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      return res.json({
        apiKey: getUnifiedApiKey(),
        geminiApiKey: getUnifiedGeminiApiKey()
      });
    } else {
      let userSettings = await UserSettings.findOne({ userId: req.userId });
      if (!userSettings) {
        // Auto-initialize settings with a fresh master API key for the cloud tenant
        userSettings = await UserSettings.create({
          userId: req.userId!,
          email: req.userEmail || 'user@example.com',
          unifiedApiKey: `omnikey-${crypto.randomBytes(24).toString('hex')}`,
          unifiedGeminiApiKey: `omnikey-g-${crypto.randomBytes(24).toString('hex')}`
        });

        // Register in PromoUser if total promo users < 500
        try {
          const promoCount = await PromoUser.countDocuments();
          if (promoCount < 500) {
            await PromoUser.create({
              userId: req.userId!,
              email: req.userEmail || 'user@example.com',
              tokensUsed: 0,
              tokensLimit: 1000000
            });
            console.log(`[Promo] User ${req.userEmail} registered as promo user #${promoCount + 1}`);
          }
        } catch (e) {
          console.error('[Promo] Failed to register promo user:', e);
        }
      } else if (!userSettings.unifiedGeminiApiKey) {
        userSettings.unifiedGeminiApiKey = `omnikey-g-${crypto.randomBytes(24).toString('hex')}`;
        await userSettings.save();
      }
      return res.json({
        apiKey: userSettings.unifiedApiKey,
        geminiApiKey: userSettings.unifiedGeminiApiKey
      });
    }
  } catch (err) {
    next(err);
  }
});

// Regenerate the unified API key
settingsRouter.post('/api-key/regenerate', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { format } = req.body || {}; // 'openai' (default) or 'gemini'
    if (format === 'gemini') {
      if (isLocalDbEnabled()) {
        const newKey = regenerateUnifiedGeminiKey();
        return res.json({
          apiKey: getUnifiedApiKey(),
          geminiApiKey: newKey
        });
      } else {
        const newKey = `omnikey-g-${crypto.randomBytes(24).toString('hex')}`;
        const userSettings = await UserSettings.findOneAndUpdate(
          { userId: req.userId },
          { 
            unifiedGeminiApiKey: newKey,
            email: req.userEmail || 'user@example.com'
          },
          { new: true, upsert: true }
        );
        return res.json({
          apiKey: userSettings.unifiedApiKey,
          geminiApiKey: userSettings.unifiedGeminiApiKey
        });
      }
    } else {
      if (isLocalDbEnabled()) {
        const newKey = regenerateUnifiedKey();
        return res.json({
          apiKey: newKey,
          geminiApiKey: getUnifiedGeminiApiKey()
        });
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
        return res.json({
          apiKey: userSettings.unifiedApiKey,
          geminiApiKey: userSettings.unifiedGeminiApiKey
        });
      }
    }
  } catch (err) {
    next(err);
  }
});
