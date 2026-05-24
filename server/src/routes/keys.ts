import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { encrypt, decrypt, maskKey } from '../lib/crypto.js';

export const keysRouter = Router();

// Active providers — must match providers/index.ts registrations + shared/types.ts Platform.
// Moonshot and MiniMax direct integrations were dropped in V4. HuggingFace
// was dropped in V4 and re-added in V13 via the router.huggingface.co route.
const PLATFORMS = [
  'google', 'groq', 'cerebras', 'sambanova', 'nvidia', 'mistral',
  'openrouter', 'github', 'cohere', 'cloudflare', 'zhipu', 'ollama',
  'kilo', 'pollinations', 'llm7', 'huggingface',
] as const;

const addKeySchema = z.object({
  platform: z.enum(PLATFORMS),
  key: z.string().min(1),
  label: z.string().optional(),
});

// List all keys (masked)
keysRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() as any[];

  const keys = rows.map(row => {
    let maskedKey = '****';
    try {
      const realKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);
      maskedKey = maskKey(realKey);
    } catch {
      maskedKey = '[decrypt failed]';
    }
    return {
      id: row.id,
      platform: row.platform,
      label: row.label,
      maskedKey,
      status: row.status,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      lastCheckedAt: row.last_checked_at,
    };
  });

  res.json(keys);
});

// Add a key
keysRouter.post('/', (req: Request, res: Response) => {
  const parsed = addKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { message: parsed.error.errors.map(e => e.message).join(', ') } });
    return;
  }

  const { platform, key, label } = parsed.data;
  const { encrypted, iv, authTag } = encrypt(key);

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
    VALUES (?, ?, ?, ?, ?, 'unknown', 1)
  `).run(platform, label ?? '', encrypted, iv, authTag);

  res.status(201).json({
    id: result.lastInsertRowid,
    platform,
    label: label ?? '',
    maskedKey: maskKey(key),
    status: 'unknown',
    enabled: true,
  });
});

// Delete a key
keysRouter.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid key ID' } });
    return;
  }

  const db = getDb();
  const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: { message: 'Key not found' } });
    return;
  }

  res.json({ success: true });
});

// Toggle enable/disable
keysRouter.patch('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: 'Invalid key ID' } });
    return;
  }

  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: { message: 'enabled must be a boolean' } });
    return;
  }

  const db = getDb();
  const result = db.prepare('UPDATE api_keys SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);

  if (result.changes === 0) {
    res.status(404).json({ error: { message: 'Key not found' } });
    return;
  }

  res.json({ success: true, enabled });
});

// Export keys as CSV
keysRouter.get('/export', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM api_keys').all() as any[];

  let csv = 'platform,key,label\n';
  for (const row of rows) {
    try {
      const realKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);
      const escapeCsv = (str: string) => {
        const escaped = (str || '').replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') ? `"${escaped}"` : escaped;
      };
      csv += `${escapeCsv(row.platform)},${escapeCsv(realKey)},${escapeCsv(row.label)}\n`;
    } catch {
      // skip if decryption fails
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=omnikey_keys_export.csv');
  res.send(csv);
});

function parseCsv(text: string): Array<{ platform: string; key: string; label: string }> {
  const lines = text.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const results: Array<{ platform: string; key: string; label: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current);

    if (row.length >= 2) {
      results.push({
        platform: row[0].trim(),
        key: row[1].trim(),
        label: (row[2] ?? '').trim(),
      });
    }
  }
  return results;
}

// Import keys from CSV
keysRouter.post('/import', (req: Request, res: Response) => {
  const { csvText } = req.body;
  if (typeof csvText !== 'string') {
    res.status(400).json({ error: { message: 'Invalid CSV data' } });
    return;
  }

  const parsed = parseCsv(csvText);
  if (parsed.length === 0) {
    res.status(400).json({ error: { message: 'No valid keys found in CSV' } });
    return;
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
    VALUES (?, ?, ?, ?, ?, 'unknown', 1)
  `);

  let importedCount = 0;
  const runTransaction = db.transaction(() => {
    for (const item of parsed) {
      if (!PLATFORMS.includes(item.platform as any)) {
        continue;
      }
      if (!item.key) continue;

      const { encrypted, iv, authTag } = encrypt(item.key);
      insert.run(item.platform, item.label, encrypted, iv, authTag);
      importedCount++;
    }
  });

  runTransaction();

  res.json({ success: true, count: importedCount });
});
