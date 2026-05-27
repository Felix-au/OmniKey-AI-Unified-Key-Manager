import { Router } from 'express';
import type { Response } from 'express';
import { getDb } from '../db/index.js';
import { checkKeyHealth, checkAllKeys } from '../services/health.js';
import { hasProvider } from '../providers/index.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { ApiKey } from '../models/ApiKey.js';

export const healthRouter = Router();

// Apply Firebase dashboard auth middleware to all health endpoints
healthRouter.use(requireDashboardAuth);

// Get health status for all platforms
healthRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();

      const platforms = db.prepare(`
        SELECT
          platform,
          COUNT(*) as total_keys,
          SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy_keys,
          SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) as rate_limited_keys,
          SUM(CASE WHEN status = 'invalid' THEN 1 ELSE 0 END) as invalid_keys,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_keys,
          SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown_keys,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_keys
        FROM api_keys
        GROUP BY platform
      `).all() as any[];

      const keys = db.prepare(`
        SELECT id, platform, label, status, enabled, created_at, last_checked_at
        FROM api_keys
        ORDER BY platform, created_at DESC
      `).all() as any[];

      return res.json({
        platforms: platforms.map(p => ({
          platform: p.platform,
          hasProvider: hasProvider(p.platform),
          totalKeys: p.total_keys,
          healthyKeys: p.healthy_keys,
          rateLimitedKeys: p.rate_limited_keys,
          invalidKeys: p.invalid_keys,
          errorKeys: p.error_keys,
          unknownKeys: p.unknown_keys,
          enabledKeys: p.enabled_keys,
        })),
        keys: keys.map(k => ({
          id: k.id.toString(), // stringify ID for client side consistency
          platform: k.platform,
          label: k.label,
          status: k.status,
          enabled: k.enabled === 1,
          createdAt: k.created_at,
          lastCheckedAt: k.last_checked_at,
        })),
      });
    } else {
      // Cloud MongoDB Mode (Multi-tenant scoped by user)
      const keys = await ApiKey.find({ userId: req.userId }).sort({ platform: 1, createdAt: -1 });

      const platformMap: Record<string, any> = {};
      for (const key of keys) {
        if (!platformMap[key.platform]) {
          platformMap[key.platform] = {
            platform: key.platform,
            total_keys: 0,
            healthy_keys: 0,
            rate_limited_keys: 0,
            invalid_keys: 0,
            error_keys: 0,
            unknown_keys: 0,
            enabled_keys: 0,
          };
        }
        const p = platformMap[key.platform];
        p.total_keys++;
        if (key.status === 'healthy') p.healthy_keys++;
        else if (key.status === 'rate_limited') p.rate_limited_keys++;
        else if (key.status === 'invalid') p.invalid_keys++;
        else if (key.status === 'error') p.error_keys++;
        else p.unknown_keys++;

        if (key.enabled) p.enabled_keys++;
      }

      const platforms = Object.values(platformMap);

      return res.json({
        platforms: platforms.map(p => ({
          platform: p.platform,
          hasProvider: hasProvider(p.platform),
          totalKeys: p.total_keys,
          healthyKeys: p.healthy_keys,
          rateLimitedKeys: p.rate_limited_keys,
          invalidKeys: p.invalid_keys,
          errorKeys: p.error_keys,
          unknownKeys: p.unknown_keys,
          enabledKeys: p.enabled_keys,
        })),
        keys: keys.map(k => ({
          id: k._id.toString(),
          platform: k.platform,
          label: k.label,
          status: k.status,
          enabled: k.enabled,
          createdAt: k.createdAt.toISOString(),
          lastCheckedAt: k.lastCheckedAt ? k.lastCheckedAt.toISOString() : null,
        })),
      });
    }
  } catch (err) {
    next(err);
  }
});

// Check a specific key
healthRouter.post('/check/:keyId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const keyId = req.params.keyId;
    if (!keyId || typeof keyId !== 'string') {
      res.status(400).json({ error: { message: 'Invalid key ID' } });
      return;
    }

    const status = await checkKeyHealth(keyId);
    res.json({ keyId, status });
  } catch (err) {
    next(err);
  }
});

// Check all keys
healthRouter.post('/check-all', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await checkAllKeys(isLocalDbEnabled() ? undefined : req.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
