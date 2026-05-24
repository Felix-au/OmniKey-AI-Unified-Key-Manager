import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Model } from '../models/Model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_PATH = path.resolve(__dirname, '../../data/OmniKeyAI.db');

export async function seedMongoModels(): Promise<void> {
  try {
    const existingCount = await Model.countDocuments();
    if (existingCount > 0) {
      console.log(`MongoDB Model catalog already initialized with ${existingCount} models.`);
      return;
    }

    let sqliteModels: any[] = [];

    // 1. Attempt to extract models from local SQLite database to preserve any custom changes
    if (fs.existsSync(SQLITE_PATH)) {
      console.log(`Found local SQLite database at ${SQLITE_PATH}. Extracting models catalog...`);
      try {
        const db = new Database(SQLITE_PATH, { readonly: true });
        sqliteModels = db.prepare('SELECT * FROM models').all();
        db.close();
        console.log(`Successfully extracted ${sqliteModels.length} models from SQLite.`);
      } catch (err) {
        console.warn('Failed to query SQLite database. Falling back to default seeding...', err);
      }
    } else {
      console.log('No local SQLite database found. Seeding default models catalog...');
    }

    // 2. Fallback to default catalog if SQLite is not present or failed to read
    if (sqliteModels.length === 0) {
      sqliteModels = getDefaultModels();
      console.log(`Using default catalog of ${sqliteModels.length} models for seeding.`);
    }

    // 3. Format and insert models into MongoDB
    const docs = sqliteModels.map((m) => ({
      platform: m.platform,
      modelId: m.model_id || m.modelId,
      displayName: m.display_name || m.displayName,
      intelligenceRank: Number(m.intelligence_rank || m.intelligenceRank),
      speedRank: Number(m.speed_rank || m.speedRank),
      sizeLabel: m.size_label || m.sizeLabel || '',
      rpmLimit: m.rpm_limit !== undefined ? m.rpm_limit : m.rpmLimit,
      rpdLimit: m.rpd_limit !== undefined ? m.rpd_limit : m.rpdLimit,
      tpmLimit: m.tpm_limit !== undefined ? m.tpm_limit : m.tpmLimit,
      tpdLimit: m.tpd_limit !== undefined ? m.tpd_limit : m.tpdLimit,
      monthlyTokenBudget: m.monthly_token_budget || m.monthlyTokenBudget || '',
      contextWindow: m.context_window !== undefined ? m.context_window : m.contextWindow,
      enabled: m.enabled === 1 || m.enabled === true
    }));

    await Model.insertMany(docs);
    console.log(`Successfully seeded ${docs.length} models into MongoDB.`);
  } catch (error) {
    console.error('Error during MongoDB model catalog seeding:', error);
  }
}

function getDefaultModels() {
  return [
    { platform: 'google', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', intelligenceRank: 1, speedRank: 8, sizeLabel: 'Frontier', rpmLimit: 5, rpdLimit: 100, tpmLimit: 250000, tpdLimit: null, monthlyTokenBudget: '~12M', contextWindow: 1048576, enabled: true },
    { platform: 'google', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', intelligenceRank: 4, speedRank: 5, sizeLabel: 'Large', rpmLimit: 10, rpdLimit: 20, tpmLimit: 250000, tpdLimit: null, monthlyTokenBudget: '~3M', contextWindow: 1048576, enabled: true },
    { platform: 'google', modelId: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', intelligenceRank: 8, speedRank: 3, sizeLabel: 'Medium', rpmLimit: 15, rpdLimit: 1000, tpmLimit: 250000, tpdLimit: null, monthlyTokenBudget: '~120M', contextWindow: 1048576, enabled: true },
    { platform: 'openrouter', modelId: 'deepseek/deepseek-v3.1:free', displayName: 'DeepSeek V3.1 (free)', intelligenceRank: 2, speedRank: 10, sizeLabel: 'Frontier', rpmLimit: 20, rpdLimit: 200, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~6M', contextWindow: 131072, enabled: true },
    { platform: 'openrouter', modelId: 'moonshotai/kimi-k2:free', displayName: 'Kimi K2 (free)', intelligenceRank: 2, speedRank: 9, sizeLabel: 'Frontier', rpmLimit: 20, rpdLimit: 200, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~6M', contextWindow: 131072, enabled: true },
    { platform: 'openrouter', modelId: 'qwen/qwen3-coder:free', displayName: 'Qwen3 Coder (free)', intelligenceRank: 3, speedRank: 9, sizeLabel: 'Frontier', rpmLimit: 20, rpdLimit: 200, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~6M', contextWindow: 262144, enabled: true },
    { platform: 'openrouter', modelId: 'z-ai/glm-4.5-air:free', displayName: 'GLM-4.5 Air (free)', intelligenceRank: 4, speedRank: 9, sizeLabel: 'Large', rpmLimit: 20, rpdLimit: 200, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~6M', contextWindow: 131072, enabled: true },
    { platform: 'github', modelId: 'openai/gpt-5', displayName: 'GPT-5 (GitHub)', intelligenceRank: 1, speedRank: 7, sizeLabel: 'Frontier', rpmLimit: 10, rpdLimit: 50, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~18M', contextWindow: 128000, enabled: true },
    { platform: 'sambanova', modelId: 'Meta-Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B', intelligenceRank: 6, speedRank: 9, sizeLabel: 'Large', rpmLimit: 20, rpdLimit: null, tpmLimit: null, tpdLimit: 200000, monthlyTokenBudget: '~6M', contextWindow: 8192, enabled: true },
    { platform: 'mistral', modelId: 'mistral-large-latest', displayName: 'Mistral Large 3', intelligenceRank: 7, speedRank: 8, sizeLabel: 'Large', rpmLimit: 2, rpdLimit: null, tpmLimit: 500000, tpdLimit: null, monthlyTokenBudget: '~50-100M', contextWindow: 131072, enabled: true },
    { platform: 'groq', modelId: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', intelligenceRank: 9, speedRank: 2, sizeLabel: 'Medium', rpmLimit: 30, rpdLimit: 1000, tpmLimit: 6000, tpdLimit: 500000, monthlyTokenBudget: '~15M', contextWindow: 131072, enabled: true },
    { platform: 'groq', modelId: 'llama-4-scout-17b-16e-instruct', displayName: 'Llama 4 Scout', intelligenceRank: 10, speedRank: 2, sizeLabel: 'Medium', rpmLimit: 30, rpdLimit: 1000, tpmLimit: 6000, tpdLimit: 1000000, monthlyTokenBudget: '~30M', contextWindow: 131072, enabled: true },
    { platform: 'cohere', modelId: 'command-r-plus-08-2024', displayName: 'Command R+ (08-2024)', intelligenceRank: 12, speedRank: 11, sizeLabel: 'Large', rpmLimit: 20, rpdLimit: 33, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~1-2M', contextWindow: 131072, enabled: true },
    { platform: 'cloudflare', modelId: '@cf/meta/llama-3.1-70b-instruct', displayName: 'Llama 3.1 70B (CF)', intelligenceRank: 13, speedRank: 11, sizeLabel: 'Medium', rpmLimit: null, rpdLimit: null, tpmLimit: null, tpdLimit: null, monthlyTokenBudget: '~18-45M', contextWindow: 131072, enabled: true }
  ];
}
