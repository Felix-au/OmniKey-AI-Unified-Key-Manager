/**
 * Dynamically evaluates if the system is configured to run in local-first database mode.
 * In local mode, the application stores data inside the local SQLite database and bypasses
 * Firebase dashboard authentication.
 */
export function isLocalDbEnabled(): boolean {
  const envValue = process.env.LOCAL_DB_ENABLED ?? process.env.local_db_enabled;
  
  // Default to true if not explicitly configured to false, ensuring a robust out-of-the-box local developer experience
  if (envValue === undefined) {
    return true;
  }
  
  return envValue.trim().toLowerCase() === 'true';
}
