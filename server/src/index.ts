import './env.js';
import { createApp } from './app.js';
import { initDb } from './db/index.js';
import { connectMongo } from './db/mongo.js';
import { seedMongoModels } from './db/mongoSeed.js';
import { startHealthChecker } from './services/health.js';

const PORT = process.env.PORT ?? 3001;

async function main() {
  // Connect to MongoDB and seed models catalog
  await connectMongo();
  await seedMongoModels();

  // Initialize SQLite for backward compatibility / baseline test support
  initDb();

  const app = createApp();

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Proxy endpoint: http://0.0.0.0:${PORT}/v1/chat/completions`);
    startHealthChecker();
  });
}

main().catch(console.error);
