import { getDb } from '../db/index.js';
import { getProvider } from '../providers/index.js';
import { decrypt } from '../lib/crypto.js';
import { canMakeRequest, canUseTokens, isOnCooldown } from './ratelimit.js';
import type { BaseProvider } from '../providers/base.js';
import { isLocalDbEnabled } from '../db/context.js';
import { Model, IModel } from '../models/Model.js';
import { UserFallbackConfig } from '../models/UserFallbackConfig.js';
import { ApiKey } from '../models/ApiKey.js';
import { PromoUser } from '../models/PromoUser.js';
import { AdminEmail } from '../models/AdminEmail.js';
import { UserSettings } from '../models/UserSettings.js';

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
  isPromo?: boolean;
  fundedByUserId?: string;
  fundedByUserEmail?: string;
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

export function isImageModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes('imagen') || 
         lower.includes('flux') || 
         lower.includes('stable-diffusion') || 
         lower.includes('dreamshaper') || 
         lower.includes('leonardo');
}

/**
 * Route a request to the best available model.
 */
export async function routeRequest(
  estimatedTokens = 1000,
  skipKeys?: Set<string>,
  preferredModelDbId?: number | string,
  userId = 'local-dev-user-uid',
  requiredModality?: string,
  estimatedInputTokens?: number,
  isImageGeneration = false
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

      const isImg = isImageModel(model.model_id);
      if (isImageGeneration && !isImg) continue;
      if (!isImageGeneration && isImg) continue;

      if (model.model_id === 'groq/compound-mini' || model.model_id.includes('groq-mini')) {
        if (estimatedInputTokens !== undefined && estimatedInputTokens > 7500) {
          continue;
        }
      }

      if (requiredModality && model.platform !== 'google') continue;

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
    const promo = await PromoUser.findOne({ userId });
    const isPromoActive = promo && promo.tokensUsed < promo.tokensLimit;

    let usePromo = false;
    let fundingUserIds: string[] = [];

    if (isPromoActive) {
      const hasKeys = await ApiKey.exists({ userId, enabled: true, status: { $ne: 'invalid' } });
      const requestedPromo = preferredModelDbId === 'omnikey-promo' || preferredModelDbId === 'promo';

      if (requestedPromo || !hasKeys) {
        usePromo = true;
        // Resolve all active funding admin IDs
        const fundingAdmins = await AdminEmail.find({ isFundingProvider: true });
        const adminEmails = fundingAdmins.map(a => a.email);
        const adminSettings = await UserSettings.find({ email: { $in: adminEmails } });
        fundingUserIds = adminSettings.map(s => s.userId);
      }
    }

    let chainToUse: Array<{ model: IModel; priority: number; effectivePriority: number }> = [];

    if (usePromo) {
      // Find all enabled real models (exclude virtual promo model itself to avoid infinite loop)
      const promoModels = await Model.find({ enabled: true, modelId: { $ne: 'omnikey-promo' } }).sort({ speedRank: 1 });
      chainToUse = promoModels.map((model, index) => ({
        model,
        priority: index + 1,
        effectivePriority: index + 1 + getPenalty(model._id.toString())
      })).sort((a, b) => a.effectivePriority - b.effectivePriority);
    } else {
      const fallbackChain = await UserFallbackConfig.find({ userId })
        .populate<{ modelId: IModel }>('modelId')
        .sort({ priority: 1 });

      chainToUse = fallbackChain.map(entry => {
        const modelIdStr = entry.modelId?._id?.toString() || '';
        return {
          model: entry.modelId,
          priority: entry.priority,
          effectivePriority: entry.priority + getPenalty(modelIdStr)
        };
      }).sort((a, b) => a.effectivePriority - b.effectivePriority);
    }

    // Sticky session (Cloud Mode)
    if (preferredModelDbId) {
      const preferredStr = preferredModelDbId.toString();
      const idx = chainToUse.findIndex(item => item.model?._id?.toString() === preferredStr);
      if (idx > 0) {
        const [preferred] = chainToUse.splice(idx, 1);
        chainToUse.unshift(preferred);
      }
    }

    for (const item of chainToUse) {
      const model = item.model;
      if (!model || !model.enabled) continue;

      const isImg = isImageModel(model.modelId);
      if (isImageGeneration && !isImg) continue;
      if (!isImageGeneration && isImg) continue;

      if (model.modelId === 'groq/compound-mini' || model.modelId.includes('groq-mini')) {
        if (estimatedInputTokens !== undefined && estimatedInputTokens > 7500) {
          continue;
        }
      }

      if (requiredModality && model.platform !== 'google') continue;

      // Intercept virtual promo model in user's custom fallback chain
      if (model.modelId === 'omnikey-promo') {
        if (!isPromoActive) continue; // skip if promo exhausted

        // Resolve funding admin IDs if not already done
        if (fundingUserIds.length === 0) {
          const fundingAdmins = await AdminEmail.find({ isFundingProvider: true });
          const adminEmails = fundingAdmins.map(a => a.email);
          const adminSettings = await UserSettings.find({ email: { $in: adminEmails } });
          fundingUserIds = adminSettings.map(s => s.userId);
        }

        if (fundingUserIds.length === 0) continue;

        // Try real models sorted by speedRank under the hood
        const promoModels = await Model.find({ enabled: true, modelId: { $ne: 'omnikey-promo' } }).sort({ speedRank: 1 });
        for (const pm of promoModels) {
          const isImg = isImageModel(pm.modelId);
          if (isImageGeneration && !isImg) continue;
          if (!isImageGeneration && isImg) continue;
          if (requiredModality && pm.platform !== 'google') continue;

          if (pm.modelId === 'groq/compound-mini' || pm.modelId.includes('groq-mini')) {
            if (estimatedInputTokens !== undefined && estimatedInputTokens > 7500) {
              continue;
            }
          }

          const provider = getProvider(pm.platform as any);
          if (!provider) continue;

          const keys = await ApiKey.find({
            userId: { $in: fundingUserIds },
            platform: pm.platform,
            enabled: true,
            status: { $ne: 'invalid' }
          });

          if (keys.length === 0) continue;

          const limits = {
            rpm: pm.rpmLimit,
            rpd: pm.rpdLimit,
            tpm: pm.tpmLimit,
            tpd: pm.tpdLimit,
          };

          const rrKey = `${pm.platform}:${pm.modelId}`;
          let idx = roundRobinIndex.get(rrKey) ?? 0;

          for (let attempt = 0; attempt < keys.length; attempt++) {
            const key = keys[idx % keys.length];
            idx++;

            // Block promo/funding keys from using Vision/TTS/Voice
            if (requiredModality && key.userId.toString() !== userId) {
              continue;
            }

            const skipId = `${pm.platform}:${pm.modelId}:${key._id}`;
            if (skipKeys?.has(skipId)) continue;

            if (isOnCooldown(pm.platform, pm.modelId, key._id.toString() as any)) continue;

            if (!canMakeRequest(pm.platform, pm.modelId, key._id.toString() as any, limits)) continue;
            if (!canUseTokens(pm.platform, pm.modelId, key._id.toString() as any, estimatedTokens, limits)) continue;

            roundRobinIndex.set(rrKey, idx);
            const decryptedKey = decrypt(key.encryptedKey, key.iv, key.authTag);

            // Fetch the admin user settings to know who is funding this request
            const adminUserSetting = await UserSettings.findOne({ userId: key.userId });

            return {
              provider,
              modelId: pm.modelId,
              modelDbId: pm._id.toString(),
              apiKey: decryptedKey,
              keyId: key._id.toString(),
              keyLabel: key.label,
              platform: pm.platform,
              displayName: pm.displayName,
              isPromo: true,
              fundedByUserId: key.userId.toString(),
              fundedByUserEmail: adminUserSetting?.email
            };
          }
          roundRobinIndex.set(rrKey, idx);
        }
        continue;
      }

      // Standard model routing logic
      const provider = getProvider(model.platform as any);
      if (!provider) continue;

      // Determine who to fetch keys for (could be admin if usePromo is true)
      const targetUserId = usePromo ? { $in: fundingUserIds } : userId;

      const keys = await ApiKey.find({
        userId: targetUserId,
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

        // Block promo/funding keys from using Vision/TTS/Voice
        if (requiredModality && key.userId.toString() !== userId) {
          continue;
        }

        const skipId = `${model.platform}:${model.modelId}:${key._id}`;
        if (skipKeys?.has(skipId)) continue;

        if (isOnCooldown(model.platform, model.modelId, key._id.toString() as any)) continue;

        if (!canMakeRequest(model.platform, model.modelId, key._id.toString() as any, limits)) continue;
        if (!canUseTokens(model.platform, model.modelId, key._id.toString() as any, estimatedTokens, limits)) continue;

        roundRobinIndex.set(rrKey, idx);
        const decryptedKey = decrypt(key.encryptedKey, key.iv, key.authTag);

        const adminUserSetting = usePromo ? await UserSettings.findOne({ userId: key.userId }) : null;

        return {
          provider,
          modelId: model.modelId,
          modelDbId: model._id.toString(),
          apiKey: decryptedKey,
          keyId: key._id.toString(),
          keyLabel: key.label,
          platform: model.platform,
          displayName: model.displayName,
          isPromo: usePromo,
          fundedByUserId: usePromo ? key.userId.toString() : undefined,
          fundedByUserEmail: usePromo ? adminUserSetting?.email : undefined
        };
      }

      roundRobinIndex.set(rrKey, idx);
    }
  }

  if ((isImageGeneration || requiredModality) && !isLocalDbEnabled()) {
    const hasKeys = await ApiKey.exists({ userId, enabled: true, status: { $ne: 'invalid' } });
    if (!hasKeys) {
      const feature = isImageGeneration ? 'Image generation capabilities' : 'Multimodal capabilities (Vision, Voice, TTS)';
      const err = new Error(`${feature} are not available on the free promo tier. Please add your own Gemini API key under Keys page to use these features.`) as any;
      err.status = 403;
      throw err;
    }
  }

  const err = new Error('All models exhausted. Add more API keys or wait for rate limits to reset.') as any;
  err.status = 429;
  throw err;
}
