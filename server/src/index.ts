import './env.js';
import { createApp } from './app.js';
import { initDb } from './db/index.js';
import { connectMongo } from './db/mongo.js';
import { seedMongoModels } from './db/mongoSeed.js';
import { startHealthChecker } from './services/health.js';

const PORT = process.env.PORT ?? 3001;

async function main() {
  let mongoConnected = false;
  try {
    // Connect to MongoDB and seed models catalog
    await connectMongo();
    await seedMongoModels();
    mongoConnected = true;
  } catch (err: any) {
    console.warn('\n========================================================================');
    console.warn('⚠️  MONGODB CONNECTION WARNING:');
    console.warn('Could not establish initial connection to your cloud MongoDB Cluster.');
    console.warn('Reason:', err.message || err);
    console.warn('\n💡 Troubleshooting Tips for querySrv / SRV blocks:');
    console.warn('1. DNS SRV Lookup Blocked: Your active DNS provider (ISP, corporate network) is failing to resolve SRV records.');
    console.warn('   -> Fix: Change your primary system DNS to Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1).');
    console.warn('2. Firewall Restrictions: You may be on a network that blocks outbound TCP connections on port 27017.');
    console.warn('   -> Fix: Test on a different network, disable local firewalls, or check VPN settings.');
    console.warn('3. IP Access Control: Ensure your MongoDB Atlas Whitelist permits connections from your current IP (use 0.0.0.0/0 for testing).');
    console.warn('\n👉 Running server in local-first fallback mode using your SQLite database...');
    console.warn('========================================================================\n');
  }

  // Initialize SQLite for backward compatibility / offline-first fallback
  initDb();

  const app = createApp();

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Proxy endpoint: http://0.0.0.0:${PORT}/v1/chat/completions`);
    startHealthChecker();
  });
}

main().catch(console.error);
