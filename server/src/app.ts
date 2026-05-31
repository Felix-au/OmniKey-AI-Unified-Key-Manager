import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { keysRouter } from './routes/keys.js';
import { modelsRouter } from './routes/models.js';
import { proxyRouter } from './routes/proxy.js';
import { geminiProxyRouter } from './routes/gemini-proxy.js';
import { fallbackRouter } from './routes/fallback.js';
import { analyticsRouter } from './routes/analytics.js';
import { healthRouter } from './routes/health.js';
import { settingsRouter } from './routes/settings.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';
import { isLocalDbEnabled, dbModeStorage } from './db/context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DASHBOARD_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://[::1]:5173',
];

function getAllowedCorsOrigins() {
  const configuredOrigins = (process.env.DASHBOARD_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_DASHBOARD_ORIGINS, ...configuredOrigins]);
}

export function createApp() {
  const app = express();
  const allowedCorsOrigins = getAllowedCorsOrigins();

  // Dynamic Per-Request Database Context Middleware
  app.use((req, res, next) => {
    let mode = req.headers['x-database-mode'] as 'local' | 'cloud' | undefined;
    if (!mode || (mode !== 'local' && mode !== 'cloud')) {
      mode = process.env.MONGODB_URI ? 'cloud' : 'local';
    }
    dbModeStorage.run(mode, () => {
      next();
    });
  });

  // CSP intentionally disabled — the SPA bundles inline styles and the OG
  // image is loaded from the same origin; enabling helmet's default CSP
  // breaks the React build's hashed-asset loader. HSTS off because this is
  // a single-user local proxy, served over HTTP on localhost. Both should
  // stay disabled unless someone serves the proxy over HTTPS publicly
  // (which is also not a supported deployment — see README).
  app.use(helmet({ contentSecurityPolicy: false, hsts: false }));
  app.use(cors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      callback(null, !origin || allowedCorsOrigins.has(origin));
    },
    exposedHeaders: ['X-Routed-Via', 'X-Fallback-Attempts', 'X-Key-Used'],
  }));
  app.use(express.json({ limit: '25mb' }));

  // API routes
  app.use('/api/keys', keysRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/fallback', fallbackRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/admin', adminRouter);

  // OpenAI-compatible proxy
  app.use('/v1', proxyRouter);

  // Gemini-compatible proxy
  app.use('/v1beta', geminiProxyRouter);

  // Health check
  app.get('/api/ping', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Render keep-alive public health check
  app.get('/api/cron-health', (_req, res) => {
    res.json({
      status: 'active',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      message: 'OmniKey AI server keep-alive heartbeat successful.'
    });
  });

  // Public config endpoint
  app.get('/api/config', (_req, res) => {
    res.json({
      cloudDbAvailable: !!process.env.MONGODB_URI
    });
  });

  // Public promotional pool status endpoint
  app.get('/api/public/promo-status', async (_req, res, next) => {
    try {
      if (isLocalDbEnabled()) {
        res.json({ activePromoUsers: 0, totalPromoLimit: 500, remainingSlots: 0, isActive: false });
        return;
      }
      const { PromoUser } = await import('./models/PromoUser.js');
      const count = await PromoUser.countDocuments();
      res.json({
        activePromoUsers: count,
        totalPromoLimit: 500,
        remainingSlots: Math.max(0, 500 - count),
        isActive: count < 500
      });
    } catch (err) {
      next(err);
    }
  });

  // Public statistics endpoint (for landing page showcase)
  app.get('/api/public/stats', async (_req, res, next) => {
    try {
      if (isLocalDbEnabled()) {
        const { getDb } = await import('./db/index.js');
        const db = getDb();
        const usageRow = db.prepare(`
          SELECT 
            SUM(CASE WHEN status IN ('success', 'error') THEN 1 ELSE 0 END) as totalRequests, 
            SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successfulRequests,
            SUM(input_tokens) as totalInputTokens, 
            SUM(output_tokens) as totalOutputTokens
          FROM requests
        `).get() as any;

        const totalRequests = usageRow?.totalRequests || 0;
        const successfulRequests = usageRow?.successfulRequests || 0;
        const totalInput = usageRow?.totalInputTokens || 0;
        const totalOutput = usageRow?.totalOutputTokens || 0;

        res.json({
          totalRequests,
          tokensChanneled: totalInput + totalOutput,
          successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100
        });
        return;
      }

      // MongoDB Cloud Mode
      const { RequestLog } = await import('./models/RequestLog.js');
      const requestStats = await RequestLog.aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: { $cond: [{ $in: ['$status', ['success', 'error']] }, 1, 0] } },
            successfulRequests: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' }
          }
        }
      ]);
      const globalUsage = requestStats[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0
      };

      const totalRequests = globalUsage.totalRequests;
      res.json({
        totalRequests,
        tokensChanneled: globalUsage.totalInputTokens + globalUsage.totalOutputTokens,
        successRate: totalRequests > 0 ? (globalUsage.successfulRequests / totalRequests) * 100 : 100
      });
    } catch (err) {
      next(err);
    }
  });

  // Error handler (for API routes)
  app.use(errorHandler);

  // Serve client static files (after API error handler)
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
