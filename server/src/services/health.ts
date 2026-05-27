import { getDb } from '../db/index.js';
import { getProvider } from '../providers/index.js';
import { decrypt } from '../lib/crypto.js';
import type { Platform, KeyStatus } from '@omnikey-ai/shared/types.js';
import { isLocalDbEnabled } from '../db/context.js';
import { ApiKey } from '../models/ApiKey.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CONSECUTIVE_FAILURES_TO_DISABLE = 3;

// Track consecutive failures per key
const failureCountLocal = new Map<number, number>();
const failureCountMongo = new Map<string, number>();

export async function checkKeyHealth(keyId: string | number): Promise<KeyStatus> {
  const localMode = isLocalDbEnabled();

  if (localMode) {
    const db = getDb();
    const numericId = typeof keyId === 'string' ? parseInt(keyId, 10) : keyId;
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(numericId) as any;
    if (!row) return 'error';

    const provider = getProvider(row.platform as Platform);
    if (!provider) return 'error';

    try {
      const apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);
      const isValid = await provider.validateKey(apiKey);

      const status: KeyStatus = isValid ? 'healthy' : 'invalid';

      db.prepare("UPDATE api_keys SET status = ?, last_checked_at = datetime('now') WHERE id = ?")
        .run(status, numericId);

      if (isValid) {
        failureCountLocal.delete(numericId);
      } else {
        const count = (failureCountLocal.get(numericId) ?? 0) + 1;
        failureCountLocal.set(numericId, count);

        if (count >= CONSECUTIVE_FAILURES_TO_DISABLE) {
          db.prepare('UPDATE api_keys SET enabled = 0 WHERE id = ?').run(numericId);
          console.log(`[Health] Auto-disabled SQLite key ${numericId} after ${count} consecutive failures`);
        }
      }

      return status;
    } catch (err: any) {
      console.error(`[Health] SQLite Key ${numericId} transport error:`, err.message);
      db.prepare("UPDATE api_keys SET status = ?, last_checked_at = datetime('now') WHERE id = ?")
        .run('error', numericId);
      return 'error';
    }
  } else {
    // MongoDB Cloud Mode
    const row = await ApiKey.findById(keyId);
    if (!row) return 'error';

    const provider = getProvider(row.platform as Platform);
    if (!provider) return 'error';

    try {
      const apiKey = decrypt(row.encryptedKey, row.iv, row.authTag);
      const isValid = await provider.validateKey(apiKey);

      const status: KeyStatus = isValid ? 'healthy' : 'invalid';

      row.status = status;
      row.lastCheckedAt = new Date();
      await row.save();

      const stringId = keyId.toString();
      if (isValid) {
        failureCountMongo.delete(stringId);
      } else {
        const count = (failureCountMongo.get(stringId) ?? 0) + 1;
        failureCountMongo.set(stringId, count);

        if (count >= CONSECUTIVE_FAILURES_TO_DISABLE) {
          row.enabled = false;
          await row.save();
          console.log(`[Health] Auto-disabled MongoDB key ${stringId} after ${count} consecutive failures`);
        }
      }

      return status;
    } catch (err: any) {
      console.error(`[Health] MongoDB Key ${keyId} transport error:`, err.message);
      row.status = 'error';
      row.lastCheckedAt = new Date();
      await row.save();
      return 'error';
    }
  }
}

export async function checkAllKeys(userId?: string): Promise<void> {
  const localMode = isLocalDbEnabled();

  if (localMode) {
    const db = getDb();
    const keys = db.prepare('SELECT id FROM api_keys WHERE enabled = 1').all() as { id: number }[];
    console.log(`[Health] Checking ${keys.length} local keys...`);
    for (const key of keys) {
      await checkKeyHealth(key.id);
    }
    console.log(`[Health] Check complete.`);
  } else {
    // Skip periodic automatic background checking for cloud keys to avoid excessive logging/network usage
    if (!userId) return;

    const keys = await ApiKey.find({ userId, enabled: true });
    console.log(`[Health] Checking ${keys.length} MongoDB cloud keys for user ${userId}...`);
    for (const key of keys) {
      await checkKeyHealth(key._id.toString());
    }
    console.log(`[Health] Check complete.`);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startHealthChecker(): void {
  if (intervalId) return;
  console.log(`[Health] Starting health checker (every ${CHECK_INTERVAL_MS / 1000}s)`);
  intervalId = setInterval(() => {
    checkAllKeys().catch(err => console.error('[Health] Check failed:', err));
  }, CHECK_INTERVAL_MS);
}

export function stopHealthChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
