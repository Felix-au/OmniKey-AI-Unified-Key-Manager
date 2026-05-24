import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { hasProvider } from '../providers/index.js';

export const modelsRouter = Router();

// List all models with availability info
modelsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const models = db.prepare(`
    SELECT m.*, fc.priority, fc.enabled as fallback_enabled
    FROM models m
    LEFT JOIN fallback_config fc ON fc.model_db_id = m.id
    ORDER BY COALESCE(fc.priority, m.intelligence_rank) ASC
  `).all() as any[];

  // Count keys per platform
  const keyCounts = db.prepare(`
    SELECT platform, COUNT(*) as count
    FROM api_keys
    WHERE enabled = 1
    GROUP BY platform
  `).all() as { platform: string; count: number }[];

  const keyCountMap = new Map(keyCounts.map(k => [k.platform, k.count]));

  function parseBudget(s: string): number {
    const match = s.match(/~?([\d.]+)(?:-([\d.]+))?([MK])?/);
    if (!match) return 0;
    const high = parseFloat(match[2] ?? match[1]);
    const unit = match[3] === 'M' ? 1_000_000 : match[3] === 'K' ? 1_000 : 1;
    return high * unit;
  }

  function formatBudget(num: number): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(num);
  }

  const result = models.map(m => {
    const keyCount = keyCountMap.get(m.platform) ?? 0;
    let monthlyTokenBudget = m.monthly_token_budget;
    if (keyCount > 1) {
      const base = parseBudget(m.monthly_token_budget);
      if (base > 0) {
        monthlyTokenBudget = `~${formatBudget(base * keyCount)} (${keyCount} keys)`;
      }
    }

    return {
      id: m.id,
      platform: m.platform,
      modelId: m.model_id,
      displayName: m.display_name,
      intelligenceRank: m.intelligence_rank,
      speedRank: m.speed_rank,
      sizeLabel: m.size_label,
      rpmLimit: m.rpm_limit,
      rpdLimit: m.rpd_limit,
      tpmLimit: m.tpm_limit,
      tpdLimit: m.tpd_limit,
      monthlyTokenBudget,
      contextWindow: m.context_window,
      enabled: m.enabled === 1,
      priority: m.priority,
      fallbackEnabled: m.fallback_enabled === 1,
      hasProvider: hasProvider(m.platform),
      keyCount,
    };
  });

  res.json(result);
});
