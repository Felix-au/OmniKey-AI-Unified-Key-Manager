import { getDb } from '../db/index.js';
import { getProvider } from '../providers/index.js';
import { decrypt } from '../lib/crypto.js';
import { canMakeRequest, canUseTokens, isOnCooldown } from './ratelimit.js';
import type { BaseProvider } from '../providers/base.js';
import { isLocalDbEnabled } from '../db/context.js';
import { Model, IModel } from '../models/Model.js';
import { UserFallbackConfig } from '../models/UserFallbackConfig.js';
import { ApiKey } from '../models/ApiKey.js';

interface ModelRow {
  id: number;
  platform: string;
  model_id: string;
  display_name: string;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  tpd_limit: number | null;
}

interface KeyRow {
  id: number;
  platform: string;
  label?: string;
  encrypted_key: string;
  iv: string;
  auth_tag: string;
  status: string;
  enabled: number;
}

interface FallbackRow {
  model_db_id: number;
  priority: number;
  enabled: number;
}

export interface RouteResult {
  provider: BaseProvider;
  modelId: string;
  modelDbId: number | string;
  apiKey: string;
  keyId: number | string;
  keyLabel?: string;
  platform: string;
  displayName: string;
}

// Round-robin index per platform
const roundRobinIndex = new Map<string, number>();

// ── Dynamic priority: track 429s per model and demote accordingly ──
const rateLimitPenalties = new Map<string, { count: number; lastHit: number; penalty: number }>();

const PENALTY_PER_429 = 3;        // each 429 adds this many priority positions
const MAX_PENALTY = 10;            // cap so a model doesn't sink forever
const DECAY_INTERVAL_MS = 2 * 60 * 1000; // penalty decays every 2 minutes
const DECAY_AMOUNT = 1;            // remove this much penalty per decay interval

/**
 * Record a 429 for a model — increases its penalty so it sinks in priority.
 */
export function recordRateLimitHit(modelDbId: number | string) {
  const key = modelDbId.toString();
  const existing = rateLimitPenalties.get(key);
  const now = Date.now();
  if (existing) {
    existing.count++;
    existing.lastHit = now;
    existing.penalty = Math.min(existing.penalty + PENALTY_PER_429, MAX_PENALTY);
  } else {
    rateLimitPenalties.set(key, { count: 1, lastHit: now, penalty: PENALTY_PER_429 });
  }
}

/**
 * Record a success for a model — reduces its penalty so it rises back up.
 */
export function recordSuccess(modelDbId: number | string) {
  const key = modelDbId.toString();
  const existing = rateLimitPenalties.get(key);
  if (existing) {
    existing.penalty = Math.max(0, existing.penalty - 1);
    if (existing.penalty === 0) {
      rateLimitPenalties.delete(key);
    }
  }
}

/**
 * Get the current penalty for a model (with time-based decay).
 */
function getPenalty(modelDbId: number | string): number {
  const key = modelDbId.toString();
  const entry = rateLimitPenalties.get(key);
  if (!entry) return 0;

  // Apply time-based decay
  const now = Date.now();
  const elapsed = now - entry.lastHit;
  const decaySteps = Math.floor(elapsed / DECAY_INTERVAL_MS);
  if (decaySteps > 0) {
    entry.penalty = Math.max(0, entry.penalty - (decaySteps * DECAY_AMOUNT));
    entry.lastHit = now; // reset so we don't double-decay
    if (entry.penalty === 0) {
      rateLimitPenalties.delete(key);
      return 0;
    }
  }

  return entry.penalty;
}

/**
 * Get current penalties for all models (for the API/dashboard).
 */
export function getAllPenalties(): Array<{ modelDbId: string; count: number; penalty: number }> {
  const result: Array<{ modelDbId: string; count: number; penalty: number }> = [];
  for (const [modelDbId, entry] of rateLimitPenalties) {
    const penalty = getPenalty(modelDbId);
    if (penalty > 0) {
      result.push({ modelDbId, count: entry.count, penalty });
    }
  }
  return result.sort((a, b) => b.penalty - a.penalty);
}

/**
 * Route a request to the best available model.
 */
export async function routeRequest(
  estimatedTokens = 1000, 
  skipKeys?: Set<string>, 
  preferredModelDbId?: number | string,
  userId = 'local-dev-user-uid'
): Promise<RouteResult> {
  
  if (isLocalDbEnabled()) {
    const db = getDb();

    // Get fallback chain ordered by priority
    const fallbackChain = db.prepare(`
      SELECT fc.model_db_id, fc.priority, fc.enabled
      FROM fallback_config fc
      ORDER BY fc.priority ASC
    `).all() as FallbackRow[];

    // Apply dynamic penalties
    const sortedChain = fallbackChain.map(entry => ({
      ...entry,
      effectivePriority: entry.priority + getPenalty(entry.model_db_id),
    })).sort((a, b) => a.effectivePriority - b.effectivePriority);

    // Sticky session
    if (preferredModelDbId) {
      const numericPreferred = typeof preferredModelDbId === 'string' ? parseInt(preferredModelDbId, 10) : preferredModelDbId;
      const idx = sortedChain.findIndex(e => e.model_db_id === numericPreferred);
      if (idx > 0) {
        const [preferred] = sortedChain.splice(idx, 1);
        sortedChain.unshift(preferred);
      }
    }

    for (const entry of sortedChain) {
      if (!entry.enabled) continue;

      const model = db.prepare('SELECT * FROM models WHERE id = ? AND enabled = 1').get(entry.model_db_id) as ModelRow | undefined;
      if (!model) continue;

      const provider = getProvider(model.platform as any);
      if (!provider) continue;

      const keys = db.prepare(
        'SELECT * FROM api_keys WHERE platform = ? AND enabled = 1 AND status != ?'
      ).all(model.platform, 'invalid') as KeyRow[];

      if (keys.length === 0) continue;

      const limits = {
        rpm: model.rpm_limit,
        rpd: model.rpd_limit,
        tpm: model.tpm_limit,
        tpd: model.tpd_limit,
      };

      const rrKey = `${model.platform}:${model.model_id}`;
      let idx = roundRobinIndex.get(rrKey) ?? 0;

      for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = keys[idx % keys.length];
        idx++;

        const skipId = `${model.platform}:${model.model_id}:${key.id}`;
        if (skipKeys?.has(skipId)) continue;

        if (isOnCooldown(model.platform, model.model_id, key.id)) continue;

        if (!canMakeRequest(model.platform, model.model_id, key.id, limits)) continue;
        if (!canUseTokens(model.platform, model.model_id, key.id, estimatedTokens, limits)) continue;

        roundRobinIndex.set(rrKey, idx);
        const decryptedKey = decrypt(key.encrypted_key, key.iv, key.auth_tag);

        return {
          provider,
          modelId: model.model_id,
          modelDbId: model.id,
          apiKey: decryptedKey,
          keyId: key.id,
          keyLabel: key.label,
          platform: model.platform,
          displayName: model.display_name,
        };
      }

      roundRobinIndex.set(rrKey, idx);
    }
  } else {
    // MongoDB multi-tenant cloud mode
    const fallbackChain = await UserFallbackConfig.find({ userId })
      .populate<{ modelId: IModel }>('modelId')
      .sort({ priority: 1 });

    const sortedChain = fallbackChain.map(entry => {
      const modelIdStr = entry.modelId?._id?.toString() || '';
      return {
        entry,
        effectivePriority: entry.priority + getPenalty(modelIdStr),
      };
    }).sort((a, b) => a.effectivePriority - b.effectivePriority);

    if (preferredModelDbId) {
      const strPreferred = preferredModelDbId.toString();
      const idx = sortedChain.findIndex(e => e.entry.modelId?._id?.toString() === strPreferred);
      if (idx > 0) {
        const [preferred] = sortedChain.splice(idx, 1);
        sortedChain.unshift(preferred);
      }
    }

    for (const item of sortedChain) {
      const c = item.entry;
      if (!c.enabled) continue;

      const model = c.modelId;
      if (!model || !model.enabled) continue;

      const provider = getProvider(model.platform as any);
      if (!provider) continue;

      const keys = await ApiKey.find({
        userId,
        platform: model.platform,
        enabled: true,
        status: { $ne: 'invalid' }
      });

      if (keys.length === 0) continue;

      const limits = {
        rpm: model.rpmLimit,
        rpd: model.rpdLimit,
        tpm: model.tpmLimit,
        tpd: model.tpdLimit,
      };

      const rrKey = `${model.platform}:${model.modelId}`;
      let idx = roundRobinIndex.get(rrKey) ?? 0;

      for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = keys[idx % keys.length];
        idx++;

        const skipId = `${model.platform}:${model.modelId}:${key._id}`;
        if (skipKeys?.has(skipId)) continue;

        if (isOnCooldown(model.platform, model.modelId, key._id.toString() as any)) continue;

        if (!canMakeRequest(model.platform, model.modelId, key._id.toString() as any, limits)) continue;
        if (!canUseTokens(model.platform, model.modelId, key._id.toString() as any, estimatedTokens, limits)) continue;

        roundRobinIndex.set(rrKey, idx);
        const decryptedKey = decrypt(key.encryptedKey, key.iv, key.authTag);

        return {
          provider,
          modelId: model.modelId,
          modelDbId: model._id.toString(),
          apiKey: decryptedKey,
          keyId: key._id.toString(),
          keyLabel: key.label,
          platform: model.platform,
          displayName: model.displayName,
        };
      }

      roundRobinIndex.set(rrKey, idx);
    }
  }

  const err = new Error('All models exhausted. Add more API keys or wait for rate limits to reset.') as any;
  err.status = 429;
  throw err;
}
