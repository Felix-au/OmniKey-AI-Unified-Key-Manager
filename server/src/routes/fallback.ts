import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { getAllPenalties } from '../services/router.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { Model, IModel } from '../models/Model.js';
import { UserFallbackConfig } from '../models/UserFallbackConfig.js';
import { ApiKey } from '../models/ApiKey.js';
import { RequestLog } from '../models/RequestLog.js';
import { PromoUser } from '../models/PromoUser.js';

function parseBudget(s: string): number {
  const m = s.match(/~?([\d.]+)(?:-([\d.]+))?([MK])?/);
  if (!m) return 0;
  const high = parseFloat(m[2] ?? m[1]);
  const unit = m[3] === 'M' ? 1_000_000 : m[3] === 'K' ? 1_000 : 1;
  return high * unit;
}

function formatBudget(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}

export const fallbackRouter = Router();

// Apply Firebase dashboard authentication
fallbackRouter.use(requireDashboardAuth);

// Get fallback chain (with dynamic penalties)
fallbackRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare(`
        SELECT fc.model_db_id, fc.priority, fc.enabled,
               m.platform, m.model_id, m.display_name, m.intelligence_rank,
               m.speed_rank, m.size_label, m.rpm_limit, m.rpd_limit,
               m.monthly_token_budget, m.enabled as model_enabled
        FROM fallback_config fc
        JOIN models m ON m.id = fc.model_db_id
        ORDER BY fc.priority ASC
      `).all() as any[];

      const keyCounts = db.prepare(`
        SELECT platform, COUNT(*) as count
        FROM api_keys WHERE enabled = 1
        GROUP BY platform
      `).all() as { platform: string; count: number }[];
      const keyCountMap = new Map(keyCounts.map(k => [k.platform, k.count]));

      const penalties = getAllPenalties();
      const penaltyMap = new Map(penalties.map(p => [p.modelDbId.toString(), p]));

      const mapped = rows.map(r => {
        const penalty = penaltyMap.get(r.model_db_id.toString());
        const keyCount = keyCountMap.get(r.platform) ?? 0;

        let monthlyTokenBudget = r.monthly_token_budget;
        if (keyCount > 1) {
          const base = parseBudget(r.monthly_token_budget);
          if (base > 0) {
            monthlyTokenBudget = `~${formatBudget(base * keyCount)} (${keyCount} keys)`;
          }
        }

        return {
          modelDbId: r.model_db_id.toString(),
          priority: r.priority,
          effectivePriority: r.priority + (penalty?.penalty ?? 0),
          penalty: penalty?.penalty ?? 0,
          rateLimitHits: penalty?.count ?? 0,
          enabled: r.enabled === 1,
          globallyDisabled: r.model_enabled !== 1,
          platform: r.platform,
          modelId: r.model_id,
          displayName: r.display_name,
          intelligenceRank: r.intelligence_rank,
          speedRank: r.speed_rank,
          sizeLabel: r.size_label,
          rpmLimit: r.rpm_limit,
          rpdLimit: r.rpd_limit,
          monthlyTokenBudget,
          keyCount,
        };
      });

      return res.json(mapped);
    } else {
      // 1. Ensure user fallback config initialized for this user
      let userConfigs = await UserFallbackConfig.find({ userId: req.userId })
        .populate<{ modelId: IModel }>('modelId')
        .sort({ priority: 1 });

      if (userConfigs.length === 0) {
        // Auto-seed default user configs if missing
        const systemModels = await Model.find().sort({ intelligenceRank: 1 });
        const initialDocs = systemModels.map((m, idx) => ({
          userId: req.userId!,
          modelId: m._id,
          priority: idx + 1,
          enabled: m.enabled
        }));
        await UserFallbackConfig.insertMany(initialDocs);

        userConfigs = await UserFallbackConfig.find({ userId: req.userId })
          .populate<{ modelId: IModel }>('modelId')
          .sort({ priority: 1 });
      } else {
        // Dynamic auto-healing: append config docs for any newly added models in the catalog
        const allCatalogModels = await Model.find();
        const existingModelIds = new Set(
          userConfigs.map(c => c.modelId?._id?.toString()).filter(Boolean)
        );

        const missingModels = allCatalogModels.filter(m => !existingModelIds.has(m._id.toString()));

        if (missingModels.length > 0) {
          const maxPriority = userConfigs.reduce((max, c) => Math.max(max, c.priority), 0);
          const newDocs = missingModels.map((m, idx) => ({
            userId: req.userId!,
            modelId: m._id,
            priority: maxPriority + idx + 1,
            enabled: m.enabled
          }));
          await UserFallbackConfig.insertMany(newDocs);

          userConfigs = await UserFallbackConfig.find({ userId: req.userId })
            .populate<{ modelId: IModel }>('modelId')
            .sort({ priority: 1 });
        }
      }

      // 2. Count enabled keys per platform for this user
      const keyCounts = await ApiKey.aggregate([
        { $match: { userId: req.userId, enabled: true, status: 'healthy' } },
        { $group: { _id: '$platform', count: { $sum: 1 } } }
      ]);
      const keyCountMap = new Map(keyCounts.map(k => [k._id, k.count]));

      const penalties = getAllPenalties();
      const penaltyMap = new Map(penalties.map(p => [p.modelDbId.toString(), p]));

      const mapped = userConfigs.map(c => {
        const m = c.modelId;
        if (!m) return null;

        const penalty = penaltyMap.get(m._id.toString());
        const keyCount = (m.platform as string) === 'omnikey' ? 1 : (keyCountMap.get(m.platform) ?? 0);

        let monthlyTokenBudget = (m.platform as string) === 'omnikey' ? '10M' : m.monthlyTokenBudget;
        if ((m.platform as string) !== 'omnikey' && keyCount > 1) {
          const base = parseBudget(m.monthlyTokenBudget);
          if (base > 0) {
            monthlyTokenBudget = `~${formatBudget(base * keyCount)} (${keyCount} keys)`;
          }
        }

        return {
          modelDbId: m._id.toString(),
          priority: c.priority,
          effectivePriority: c.priority + (penalty?.penalty ?? 0),
          penalty: penalty?.penalty ?? 0,
          rateLimitHits: penalty?.count ?? 0,
          enabled: c.enabled,
          globallyDisabled: !m.enabled,
          platform: m.platform,
          modelId: m.modelId,
          displayName: m.displayName,
          intelligenceRank: m.intelligenceRank,
          speedRank: m.speedRank,
          sizeLabel: m.sizeLabel,
          rpmLimit: m.rpmLimit,
          rpdLimit: m.rpdLimit,
          monthlyTokenBudget,
          keyCount,
        };
      }).filter(Boolean);

      return res.json(mapped);
    }
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.array(z.object({
  modelDbId: z.string(),
  priority: z.number(),
  enabled: z.boolean(),
}));

// Update fallback chain (full replace)
fallbackRouter.put('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', ') } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      const update = db.prepare(`
        UPDATE fallback_config SET priority = ?, enabled = ? WHERE model_db_id = ?
      `);

      const updateAll = db.transaction(() => {
        for (const entry of parsed.data) {
          update.run(entry.priority, entry.enabled ? 1 : 0, parseInt(entry.modelDbId, 10));
        }
      });
      updateAll();

      return res.json({ success: true });
    } else {
      for (const entry of parsed.data) {
        await UserFallbackConfig.updateOne(
          { userId: req.userId, modelId: entry.modelDbId },
          { priority: entry.priority, enabled: entry.enabled }
        );
      }

      return res.json({ success: true });
    }
  } catch (err) {
    next(err);
  }
});

// Sort presets
const SORT_PRESETS: Record<string, string> = {
  intelligence: 'm.intelligence_rank ASC',
  speed: 'm.speed_rank ASC',
  budget: "CASE m.monthly_token_budget WHEN '~120M' THEN 1 WHEN '~50-100M' THEN 2 WHEN '~30M' THEN 3 WHEN '~18-45M' THEN 4 WHEN '~18M' THEN 5 WHEN '~15M' THEN 6 WHEN '~12M' THEN 7 WHEN '~6M' THEN 8 WHEN '~5-10M' THEN 9 WHEN '~4M' THEN 10 ELSE 11 END ASC",
};

fallbackRouter.post('/sort/:preset', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const preset = String(req.params.preset);
    const orderBy = SORT_PRESETS[preset];
    if (!orderBy) {
      res.status(400).json({ error: { message: `Unknown preset: ${preset}. Use: intelligence, speed, budget` } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      const models = db.prepare(`SELECT m.id FROM models m ORDER BY ${orderBy}`).all() as { id: number }[];

      const update = db.prepare('UPDATE fallback_config SET priority = ? WHERE model_db_id = ?');
      const reorder = db.transaction(() => {
        for (let i = 0; i < models.length; i++) {
          update.run(i + 1, models[i].id);
        }
      });
      reorder();

      return res.json({ success: true, preset });
    } else {
      let mongooseSort: any = {};
      if (preset === 'intelligence') mongooseSort = { intelligenceRank: 1 };
      else if (preset === 'speed') mongooseSort = { speedRank: 1 };
      else {
        // Fallback to sorting by intelligence rank on other presets
        mongooseSort = { intelligenceRank: 1 };
      }

      const models = await Model.find({ enabled: true }).sort(mongooseSort);

      for (let i = 0; i < models.length; i++) {
        await UserFallbackConfig.updateOne(
          { userId: req.userId, modelId: models[i]._id },
          { priority: i + 1 }
        );
      }

      return res.json({ success: true, preset });
    }
  } catch (err) {
    next(err);
  }
});

// Token usage per model for the stacked bar
fallbackRouter.get('/token-usage', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();

      const platforms = db.prepare(`
        SELECT DISTINCT ak.platform
        FROM api_keys ak
        WHERE ak.enabled = 1
      `).all() as { platform: string }[];
      const platformSet = new Set(platforms.map(p => p.platform));

      const keyCounts = db.prepare(`
        SELECT platform, COUNT(*) as count
        FROM api_keys WHERE enabled = 1
        GROUP BY platform
      `).all() as { platform: string; count: number }[];
      const keyCountMap = new Map(keyCounts.map(k => [k.platform, k.count]));

      const models = db.prepare(`
        SELECT m.platform, m.model_id, m.display_name, m.monthly_token_budget,
               fc.priority
        FROM models m
        JOIN fallback_config fc ON fc.model_db_id = m.id
        WHERE fc.enabled = 1
        ORDER BY fc.priority ASC
      `).all() as { platform: string; model_id: string; display_name: string; monthly_token_budget: string; priority: number }[];

      const modelBudgets = models
        .filter(m => platformSet.has(m.platform))
        .map(m => {
          const count = keyCountMap.get(m.platform) ?? 0;
          const baseBudget = parseBudget(m.monthly_token_budget);
          return {
            displayName: m.display_name,
            platform: m.platform,
            budget: baseBudget * count,
          };
        });

      const totalBudget = modelBudgets.reduce((s, m) => s + m.budget, 0);

      const usage = db.prepare(`
        SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_used
        FROM requests
        WHERE created_at >= datetime('now', 'start of month')
      `).get() as { total_used: number };

      return res.json({
        totalBudget,
        totalUsed: usage.total_used,
        models: modelBudgets,
      });
    } else {
      // 1. Get user's enabled keys platforms
      const keys = await ApiKey.find({ userId: req.userId, enabled: true, status: 'healthy' });
      const platformSet = new Set(keys.map(k => k.platform));

      const promoUser = await PromoUser.findOne({ userId: req.userId });
      const hasPromo = promoUser && promoUser.tokensUsed < promoUser.tokensLimit;

      if (hasPromo) {
        platformSet.add('omnikey' as any);
      }

      const keyCounts = await ApiKey.aggregate([
        { $match: { userId: req.userId, enabled: true, status: 'healthy' } },
        { $group: { _id: '$platform', count: { $sum: 1 } } }
      ]);
      const keyCountMap = new Map(keyCounts.map(k => [k._id as any, k.count]));
      if (hasPromo) {
        keyCountMap.set('omnikey' as any, 1);
      }

      // 2. Fetch models ordered by priority
      const userConfigs = await UserFallbackConfig.find({ userId: req.userId, enabled: true })
        .populate<{ modelId: IModel }>('modelId')
        .sort({ priority: 1 });

      const modelBudgets = userConfigs
        .map(c => c.modelId)
        .filter(m => m && platformSet.has(m.platform as any))
        .map(m => {
          const count = (m.platform as string) === 'omnikey' ? 1 : (keyCountMap.get(m.platform as any) ?? 0);
          const baseBudget = (m.platform as string) === 'omnikey' ? (promoUser ? promoUser.tokensLimit : 10_000_000) : parseBudget(m.monthlyTokenBudget);
          return {
            displayName: m.displayName,
            platform: m.platform,
            budget: baseBudget * count,
          };
        });

      const totalBudget = modelBudgets.reduce((s, m) => s + m.budget, 0);

      // 3. Count total consumed tokens this month for this user (or all time if promo only)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const queryFilter = (keys.length === 0 && hasPromo)
        ? { userId: req.userId }
        : {
            $or: [{ userId: req.userId }, { fundedByUserId: req.userId }],
            createdAt: { $gte: startOfMonth }
          };

      const usageStats = await RequestLog.aggregate([
        { $match: queryFilter },
        {
          $group: {
            _id: null,
            totalUsed: { $sum: { $add: ['$inputTokens', '$outputTokens'] } }
          }
        }
      ]);

      const totalUsed = usageStats[0]?.totalUsed || 0;

      return res.json({
        totalBudget,
        totalUsed,
        models: modelBudgets,
      });
    }
  } catch (err) {
    next(err);
  }
});
