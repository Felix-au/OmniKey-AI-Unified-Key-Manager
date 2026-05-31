import { Router } from 'express';
import type { Response } from 'express';
import { getDb } from '../db/index.js';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { isLocalDbEnabled } from '../db/context.js';
import { RequestLog } from '../models/RequestLog.js';

export const analyticsRouter = Router();

// Apply Firebase dashboard authentication
analyticsRouter.use(requireDashboardAuth);

// Map range to a JS-computed ISO timestamp
function getSinceTimestamp(range: string): string {
  const now = Date.now();
  switch (range) {
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '7d':
    default:
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

// Summary stats
analyticsRouter.get('/summary', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const range = (req.query.range as string) ?? '7d';
    const since = getSinceTimestamp(range);

    if (isLocalDbEnabled()) {
      const db = getDb();
      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('success', 'error') THEN 1 ELSE 0 END) as total_requests,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          AVG(latency_ms) as avg_latency_ms
        FROM requests
        WHERE created_at >= ?
      `).get(since) as any;

      const totalRequests = stats.total_requests ?? 0;
      const successRate = totalRequests > 0 ? (stats.success_count / totalRequests) * 100 : 0;

      // Estimate cost savings: average ~$3/M input + $15/M output tokens in INR (1 USD = 83 INR)
      const inputCost = ((stats.total_input_tokens ?? 0) / 1_000_000) * 3 * 83;
      const outputCost = ((stats.total_output_tokens ?? 0) / 1_000_000) * 15 * 83;

      return res.json({
        totalRequests,
        successRate: Math.round(successRate * 10) / 10,
        totalInputTokens: stats.total_input_tokens ?? 0,
        totalOutputTokens: stats.total_output_tokens ?? 0,
        avgLatencyMs: Math.round(stats.avg_latency_ms ?? 0),
        estimatedCostSavings: Math.round((inputCost + outputCost) * 100) / 100,
      });
    } else {
      const stats = await RequestLog.aggregate([
        { $match: { $or: [{ userId: req.userId }, { fundedByUserId: req.userId }], createdAt: { $gte: new Date(since) } } },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: { $cond: [{ $in: ['$status', ['success', 'error']] }, 1, 0] } },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' },
            avgLatencyMs: { $avg: '$latencyMs' }
          }
        }
      ]);

      const s = stats[0] || {
        totalRequests: 0,
        successCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        avgLatencyMs: 0
      };

      const totalRequests = s.totalRequests ?? 0;
      const successRate = totalRequests > 0 ? (s.successCount / totalRequests) * 100 : 0;

      const inputCost = ((s.totalInputTokens ?? 0) / 1_000_000) * 3 * 83;
      const outputCost = ((s.totalOutputTokens ?? 0) / 1_000_000) * 15 * 83;

      return res.json({
        totalRequests,
        successRate: Math.round(successRate * 10) / 10,
        totalInputTokens: s.totalInputTokens ?? 0,
        totalOutputTokens: s.totalOutputTokens ?? 0,
        avgLatencyMs: Math.round(s.avgLatencyMs ?? 0),
        estimatedCostSavings: Math.round((inputCost + outputCost) * 100) / 100,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Stats grouped by model
analyticsRouter.get('/by-model', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const range = (req.query.range as string) ?? '7d';
    const since = getSinceTimestamp(range);

    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare(`
        SELECT
          r.platform,
          r.model_id,
          m.display_name,
          COUNT(*) as requests,
          SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
          AVG(r.latency_ms) as avg_latency_ms,
          SUM(r.input_tokens) as total_input_tokens,
          SUM(r.output_tokens) as total_output_tokens
        FROM requests r
        LEFT JOIN models m ON m.platform = r.platform AND m.model_id = r.model_id
        WHERE r.created_at >= ?
        GROUP BY r.platform, r.model_id
        ORDER BY requests DESC
      `).all(since) as any[];

      const mapped = rows.map(r => ({
        platform: r.platform,
        modelId: r.model_id,
        displayName: r.display_name ?? r.model_id,
        requests: r.requests,
        successRate: Math.round(r.success_rate * 10) / 10,
        avgLatencyMs: Math.round(r.avg_latency_ms),
        totalInputTokens: r.total_input_tokens ?? 0,
        totalOutputTokens: r.total_output_tokens ?? 0,
      }));

      return res.json(mapped);
    } else {
      const rows = await RequestLog.aggregate([
        { $match: { $or: [{ userId: req.userId }, { fundedByUserId: req.userId }], createdAt: { $gte: new Date(since) } } },
        {
          $group: {
            _id: { platform: '$platform', modelId: '$modelId' },
            requests: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            avgLatencyMs: { $avg: '$latencyMs' },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' }
          }
        },
        { $sort: { requests: -1 } }
      ]);

      const mapped = rows.map(r => {
        const successRate = r.requests > 0 ? (r.successCount / r.requests) * 100 : 0;
        return {
          platform: r._id.platform,
          modelId: r._id.modelId,
          displayName: r._id.modelId,
          requests: r.requests,
          successRate: Math.round(successRate * 10) / 10,
          avgLatencyMs: Math.round(r.avgLatencyMs ?? 0),
          totalInputTokens: r.totalInputTokens ?? 0,
          totalOutputTokens: r.totalOutputTokens ?? 0,
        };
      });

      return res.json(mapped);
    }
  } catch (err) {
    next(err);
  }
});

// Stats grouped by platform
analyticsRouter.get('/by-platform', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const range = (req.query.range as string) ?? '7d';
    const since = getSinceTimestamp(range);

    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare(`
        SELECT
          platform,
          COUNT(*) as requests,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
          AVG(latency_ms) as avg_latency_ms,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens
        FROM requests
        WHERE created_at >= ?
        GROUP BY platform
        ORDER BY requests DESC
      `).all(since) as any[];

      const mapped = rows.map(r => ({
        platform: r.platform,
        requests: r.requests,
        successRate: Math.round(r.success_rate * 10) / 10,
        avgLatencyMs: Math.round(r.avg_latency_ms),
        totalInputTokens: r.total_input_tokens ?? 0,
        totalOutputTokens: r.total_output_tokens ?? 0,
      }));

      return res.json(mapped);
    } else {
      const rows = await RequestLog.aggregate([
        { $match: { $or: [{ userId: req.userId }, { fundedByUserId: req.userId }], createdAt: { $gte: new Date(since) } } },
        {
          $group: {
            _id: '$platform',
            requests: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            avgLatencyMs: { $avg: '$latencyMs' },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' }
          }
        },
        { $sort: { requests: -1 } }
      ]);

      const mapped = rows.map(r => {
        const successRate = r.requests > 0 ? (r.successCount / r.requests) * 100 : 0;
        return {
          platform: r._id,
          requests: r.requests,
          successRate: Math.round(successRate * 10) / 10,
          avgLatencyMs: Math.round(r.avgLatencyMs ?? 0),
          totalInputTokens: r.totalInputTokens ?? 0,
          totalOutputTokens: r.totalOutputTokens ?? 0,
        };
      });

      return res.json(mapped);
    }
  } catch (err) {
    next(err);
  }
});

// Timeline data
analyticsRouter.get('/timeline', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const range = (req.query.range as string) ?? '7d';
    const interval = (req.query.interval as string) ?? (range === '24h' ? 'hour' : 'day');
    const since = getSinceTimestamp(range);

    if (isLocalDbEnabled()) {
      const db = getDb();
      const dateFormat = interval === 'hour' ? '%Y-%m-%dT%H:00:00' : '%Y-%m-%d';

      const rows = db.prepare(`
        SELECT
          strftime('${dateFormat}', datetime(created_at, '+5 hours', '30 minutes')) as timestamp,
          SUM(CASE WHEN status IN ('success', 'error') THEN 1 ELSE 0 END) as requests,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failure_count
        FROM requests
        WHERE created_at >= ?
        GROUP BY strftime('${dateFormat}', datetime(created_at, '+5 hours', '30 minutes'))
        ORDER BY timestamp ASC
      `).all(since) as any[];

      const mapped = rows.map(r => ({
        timestamp: r.timestamp,
        requests: r.requests,
        successCount: r.success_count,
        failureCount: r.failure_count,
      }));

      return res.json(mapped);
    } else {
      const format = interval === 'hour' ? '%Y-%m-%dT%H:00:00Z' : '%Y-%m-%d';

      const rows = await RequestLog.aggregate([
        { $match: { $or: [{ userId: req.userId }, { fundedByUserId: req.userId }], createdAt: { $gte: new Date(since) } } },
        {
          $group: {
            _id: { $dateToString: { format: format, date: '$createdAt', timezone: '+05:30' } },
            requests: { $sum: { $cond: [{ $in: ['$status', ['success', 'error']] }, 1, 0] } },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            failureCount: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const mapped = rows.map(r => ({
        timestamp: r._id,
        requests: r.requests,
        successCount: r.successCount,
        failureCount: r.failureCount,
      }));

      return res.json(mapped);
    }
  } catch (err) {
    next(err);
  }
});

// Error distribution
analyticsRouter.get('/error-distribution', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const range = (req.query.range as string) ?? '7d';
    const since = getSinceTimestamp(range);

    if (isLocalDbEnabled()) {
      const db = getDb();

      const rows = db.prepare(`
        SELECT
          platform,
          model_id,
          CASE
            WHEN error LIKE '%429%' OR error LIKE '%rate limit%' OR error LIKE '%too many%' OR error LIKE '%quota%' THEN 'Rate Limited (429)'
            WHEN error LIKE '%401%' OR error LIKE '%unauthorized%' OR error LIKE '%invalid.*key%' THEN 'Auth Error (401)'
            WHEN error LIKE '%403%' OR error LIKE '%forbidden%' THEN 'Forbidden (403)'
            WHEN error LIKE '%404%' OR error LIKE '%not found%' THEN 'Not Found (404)'
            WHEN error LIKE '%timeout%' OR error LIKE '%ETIMEDOUT%' OR error LIKE '%ECONNREFUSED%' THEN 'Timeout/Connection'
            WHEN error LIKE '%500%' OR error LIKE '%internal server%' THEN 'Server Error (500)'
            WHEN error LIKE '%503%' OR error LIKE '%unavailable%' THEN 'Unavailable (503)'
            ELSE 'Other'
          END as error_category,
          COUNT(*) as count
        FROM requests
        WHERE status IN ('error', 'fallback') AND created_at >= ?
        GROUP BY platform, error_category
        ORDER BY count DESC
      `).all(since) as any[];

      const byCategory = db.prepare(`
        SELECT
          CASE
            WHEN error LIKE '%429%' OR error LIKE '%rate limit%' OR error LIKE '%too many%' OR error LIKE '%quota%' THEN 'Rate Limited (429)'
            WHEN error LIKE '%401%' OR error LIKE '%unauthorized%' OR error LIKE '%invalid.*key%' THEN 'Auth Error (401)'
            WHEN error LIKE '%403%' OR error LIKE '%forbidden%' THEN 'Forbidden (403)'
            WHEN error LIKE '%404%' OR error LIKE '%not found%' THEN 'Not Found (404)'
            WHEN error LIKE '%timeout%' OR error LIKE '%ETIMEDOUT%' OR error LIKE '%ECONNREFUSED%' THEN 'Timeout/Connection'
            WHEN error LIKE '%500%' OR error LIKE '%internal server%' THEN 'Server Error (500)'
            WHEN error LIKE '%503%' OR error LIKE '%unavailable%' THEN 'Unavailable (503)'
            ELSE 'Other'
          END as category,
          COUNT(*) as count
        FROM requests
        WHERE status IN ('error', 'fallback') AND created_at >= ?
        GROUP BY category
        ORDER BY count DESC
      `).all(since) as any[];

      const byPlatform = db.prepare(`
        SELECT platform, COUNT(*) as count
        FROM requests
        WHERE status IN ('error', 'fallback') AND created_at >= ?
        GROUP BY platform
        ORDER BY count DESC
      `).all(since) as any[];

      return res.json({
        byCategory,
        byPlatform,
        detailed: rows,
      });
    } else {
      const errorLogs = await RequestLog.find({
        $or: [{ userId: req.userId }, { fundedByUserId: req.userId }],
        status: { $in: ['error', 'fallback'] },
        createdAt: { $gte: new Date(since) }
      });

      const categorize = (err: string | null): string => {
        const error = (err ?? '').toLowerCase();
        if (error.includes('429') || error.includes('rate limit') || error.includes('too many') || error.includes('quota')) {
          return 'Rate Limited (429)';
        }
        if (error.includes('401') || error.includes('unauthorized') || error.includes('invalid key')) {
          return 'Auth Error (401)';
        }
        if (error.includes('403') || error.includes('forbidden')) {
          return 'Forbidden (403)';
        }
        if (error.includes('404') || error.includes('not found')) {
          return 'Not Found (404)';
        }
        if (error.includes('timeout') || error.includes('etimedout') || error.includes('econnrefused')) {
          return 'Timeout/Connection';
        }
        if (error.includes('500') || error.includes('internal server')) {
          return 'Server Error (500)';
        }
        if (error.includes('503') || error.includes('unavailable')) {
          return 'Unavailable (503)';
        }
        return 'Other';
      };

      const categoryMap = new Map<string, number>();
      const platformMap = new Map<string, number>();
      const detailedMap = new Map<string, number>();

      for (const log of errorLogs) {
        const cat = categorize(log.error);
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
        platformMap.set(log.platform, (platformMap.get(log.platform) ?? 0) + 1);

        const detKey = `${log.platform}||${log.modelId}||${cat}`;
        detailedMap.set(detKey, (detailedMap.get(detKey) ?? 0) + 1);
      }

      const byCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count
      })).sort((a, b) => b.count - a.count);

      const byPlatform = Array.from(platformMap.entries()).map(([platform, count]) => ({
        platform,
        count
      })).sort((a, b) => b.count - a.count);

      const detailed = Array.from(detailedMap.entries()).map(([key, count]) => {
        const [platform, modelId, errorCategory] = key.split('||');
        return {
          platform,
          model_id: modelId,
          error_category: errorCategory,
          count
        };
      }).sort((a, b) => b.count - a.count);

      return res.json({
        byCategory,
        byPlatform,
        detailed
      });
    }
  } catch (err) {
    next(err);
  }
});

// Recent errors
analyticsRouter.get('/errors', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const range = (req.query.range as string) ?? '7d';
    const since = getSinceTimestamp(range);

    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, platform, model_id, status, error, latency_ms, created_at
        FROM requests
        WHERE status IN ('error', 'fallback') AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(since) as any[];

      const mapped = rows.map(r => ({
        id: r.id.toString(),
        platform: r.platform,
        modelId: r.model_id,
        status: r.status,
        error: r.error,
        latencyMs: r.latency_ms,
        createdAt: r.created_at,
      }));

      return res.json(mapped);
    } else {
      const rows = await RequestLog.find({
        $or: [{ userId: req.userId }, { fundedByUserId: req.userId }],
        status: { $in: ['error', 'fallback'] },
        createdAt: { $gte: new Date(since) }
      })
      .sort({ createdAt: -1 })
      .limit(50);

      const mapped = rows.map(r => ({
        id: r._id.toString(),
        platform: r.platform,
        modelId: r.modelId,
        status: r.status,
        error: r.error,
        latencyMs: r.latencyMs,
        createdAt: r.createdAt.toISOString(),
      }));

      return res.json(mapped);
    }
  } catch (err) {
    next(err);
  }
});
