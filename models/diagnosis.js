import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dns from 'node:dns';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

// Resolve DNS SRV records using public DNS servers to prevent connection hangs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('[DNS] Failed to set public DNS servers:', e);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SQLITE_PATH = path.resolve(__dirname, '../server/data/OmniKeyAI.db');
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

// MongoDB Model schema
const ModelSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  modelId: { type: String, required: true },
  displayName: { type: String, required: true },
  enabled: { type: Boolean, default: true }
});
const Model = mongoose.models.Model || mongoose.model('Model', ModelSchema);

// MongoDB ApiKey schema
const ApiKeySchema = new mongoose.Schema({
  platform: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  status: { type: String, default: 'healthy' },
  userId: { type: String, required: true }
});
const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema, 'apikeys');

// MongoDB UserSettings schema to dynamically retrieve the primary user ID
const UserSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String }
});
const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema, 'usersettings');

async function main() {
  console.log('--- STARTING OMNIKEY AI MODEL CATALOG DIAGNOSIS ---');

  // 1. Fetch data from SQLite
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`SQLite database not found at path: ${SQLITE_PATH}`);
    process.exit(1);
  }

  console.log(`Connecting to local SQLite database: ${SQLITE_PATH}`);
  const sqliteDb = new Database(SQLITE_PATH, { readonly: true });
  const sqliteModels = sqliteDb.prepare('SELECT platform, model_id, enabled FROM models').all();
  const sqliteKeys = sqliteDb.prepare("SELECT platform FROM api_keys WHERE enabled = 1 AND status = 'healthy'").all();
  
  const sqliteKeyCountMap = new Map();
  for (const k of sqliteKeys) {
    sqliteKeyCountMap.set(k.platform, (sqliteKeyCountMap.get(k.platform) || 0) + 1);
  }
  sqliteDb.close();
  console.log(`Extracted ${sqliteModels.length} models from SQLite.`);

  const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':******@');
  console.log('Connecting to cloud MongoDB database at:', maskedUri);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to database:', mongoose.connection.name);
  
  const mongoModels = await Model.find().lean();
  console.log(`Extracted ${mongoModels.length} models from MongoDB.`);
  
  // Resolve the target user dynamically
  const primaryUser = await UserSettings.findOne().lean();
  const targetUserId = primaryUser ? primaryUser.userId : 'Ki4pdAwthqXe3tPUUxw8GTV8OQL2';
  console.log(`Resolved target user ID for API Key check: ${targetUserId} (${primaryUser?.email || 'Default Felix'})`);

  const mongoKeys = await ApiKey.find({ userId: targetUserId, enabled: true, status: 'healthy' }).lean();
  const mongoKeyCountMap = new Map();
  for (const k of mongoKeys) {
    mongoKeyCountMap.set(k.platform, (mongoKeyCountMap.get(k.platform) || 0) + 1);
  }
  await mongoose.disconnect();
  console.log(`Extracted ${mongoModels.length} models from MongoDB.`);

  const mongoModelsMap = new Map(mongoModels.map(m => [`${m.platform}/${m.modelId}`, m]));

  // 3. Process and consolidate the results
  const reportData = [];

  for (const sm of sqliteModels) {
    const fullModelId = `${sm.platform}/${sm.model_id}`;
    const sqliteEnabled = sm.enabled === 1;
    const sqliteHasKey = (sqliteKeyCountMap.get(sm.platform) ?? 0) > 0;
    const localAvailable = sqliteEnabled && sqliteHasKey;

    const mm = mongoModelsMap.get(fullModelId);
    const mongoEnabled = mm ? mm.enabled : false;
    const mongoHasKey = (mongoKeyCountMap.get(sm.platform) ?? 0) > 0;
    const cloudAvailable = mongoEnabled && mongoHasKey;

    // Determine Result value
    let result = 'Not Available';
    if (!sqliteEnabled && !mongoEnabled) {
      result = 'Disabled';
    } else if (localAvailable && cloudAvailable) {
      result = 'Available';
    } else if (sqliteEnabled && mongoEnabled && !sqliteHasKey && !mongoHasKey) {
      result = 'No Api';
    } else if (localAvailable && !cloudAvailable) {
      result = 'Available (Local Only)';
    } else if (!localAvailable && cloudAvailable) {
      result = 'Available (Cloud Only)';
    } else if (sqliteEnabled && !sqliteHasKey) {
      result = 'No Api (Local)';
    } else if (mongoEnabled && !mongoHasKey) {
      result = 'No Api (Cloud)';
    }

    reportData.push({
      'model': fullModelId,
      'local db': sqliteEnabled ? 'enabled' : 'disabled',
      'cloud db': mongoEnabled ? 'enabled' : 'disabled',
      'result': result
    });
  }

  // Sort alphabetically by Model ID
  reportData.sort((a, b) => a.model.localeCompare(b.model));

  // 4. Output the table to the console
  console.log('\n--- DIAGNOSIS RESULTS ---');
  console.table(reportData);

  // 5. Export to formats
  const csvPath = path.resolve(__dirname, 'models_report.csv');
  const jsonPath = path.resolve(__dirname, 'models_report.json');
  const xlsxPath = path.resolve(__dirname, 'models_report.xlsx');

  // A. JSON Export
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(`Successfully exported JSON report to: ${jsonPath}`);

  // B. CSV Export
  const csvHeaders = 'model,"local db","cloud db",result\n';
  const csvRows = reportData.map(r => `"${r.model}","${r['local db']}","${r['cloud db']}","${r.result}"`).join('\n');
  fs.writeFileSync(csvPath, csvHeaders + csvRows, 'utf-8');
  console.log(`Successfully exported CSV report to: ${csvPath}`);

  // C. Excel (XLSX) Export using SheetJS
  const worksheet = XLSX.utils.json_to_sheet(reportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Models Catalog Report');
  
  // Adjust column widths for readability in Excel
  const colWidths = [
    { wch: 50 }, // model
    { wch: 15 }, // local db
    { wch: 15 }, // cloud db
    { wch: 25 }  // result
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, xlsxPath);
  console.log(`Successfully exported Excel report to: ${xlsxPath}`);

  console.log('\n--- DIAGNOSIS COMPLETED SUCCESSFULLY ---');
}

main().catch(err => {
  console.error('Diagnosis failed with error:', err);
  process.exit(1);
});
