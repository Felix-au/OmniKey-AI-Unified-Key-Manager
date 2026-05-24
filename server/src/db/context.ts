import { AsyncLocalStorage } from 'node:async_hooks';

// AsyncLocalStorage to dynamically pass request-specific database contexts
export const dbModeStorage = new AsyncLocalStorage<'local' | 'cloud'>();

/**
 * Dynamically evaluates if the system is configured to run in local-first database mode.
 * In local mode, the application stores data inside the local SQLite database and bypasses
 * Firebase dashboard authentication.
 * 
 * Supports dynamic request-level context (via AsyncLocalStorage) and fallback to process.env.MONGODB_URI.
 */
export function isLocalDbEnabled(): boolean {
  const storeMode = dbModeStorage.getStore();
  if (storeMode) {
    return storeMode === 'local';
  }

  // Fallback to process.env.MONGODB_URI presence if no active request context:
  // If MongoDB URI is configured, cloud is the default; otherwise local SQLite is the default.
  return !process.env.MONGODB_URI;
}
