import { Router } from 'express';
import type { Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { hashPassword } from '../lib/crypto.js';
import { isLocalDbEnabled } from '../db/context.js';
import { AdminUser } from '../models/AdminUser.js';
import { UserSettings } from '../models/UserSettings.js';
import { ApiKey } from '../models/ApiKey.js';
import { RequestLog } from '../models/RequestLog.js';
import { Model } from '../models/Model.js';
import admin from 'firebase-admin';
import { AdminEmail } from '../models/AdminEmail.js';
import { PromoUser } from '../models/PromoUser.js';
import { ProjectKey } from '../models/ProjectKey.js';
import { PromoProjectRequest } from '../models/PromoProjectRequest.js';

export const adminRouter = Router();

// In-memory admin session storage
const ADMIN_SESSIONS = new Set<string>();

/**
 * Middleware to secure admin endpoints.
 * Verifies the admin token from headers.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Unauthorized admin access' } });
    return;
  }
  const token = authHeader.substring(7);
  if (!ADMIN_SESSIONS.has(token)) {
    res.status(401).json({ error: { message: 'Session expired or invalid' } });
    return;
  }
  next();
}

/**
 * POST /api/admin/login
 * Public login endpoint for admin.
 */
adminRouter.post('/login', async (req, res, next) => {
  try {
    const { idToken, username, password } = req.body;

    if (idToken) {
      // Google Sign-In verification (Firebase)
      if (!process.env.FIREBASE_PROJECT_ID && isLocalDbEnabled()) {
        // Fallback for local development if Firebase is not configured
        const token = crypto.randomBytes(32).toString('hex');
        ADMIN_SESSIONS.add(token);
        res.json({ success: true, token });
        return;
      }

      // Verify the ID token via Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email;
      if (!email) {
        res.status(403).json({ error: { message: 'Access denied. Email not found in token.' } });
        return;
      }

      let isAllowed = false;
      if (isLocalDbEnabled()) {
        const db = getDb();
        const row = db.prepare('SELECT * FROM admin_emails WHERE LOWER(email) = LOWER(?)').get(email);
        isAllowed = !!row;
      } else {
        const adminEmail = await AdminEmail.findOne({ email: email.toLowerCase() });
        isAllowed = !!adminEmail;
      }

      if (!isAllowed) {
        res.status(403).json({ error: { message: 'Access denied. You are not authorized as an administrator.' } });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      ADMIN_SESSIONS.add(token);
      res.json({ success: true, token });
      return;
    }

    // Username/password login is ONLY allowed in local/offline modes
    const isLocalOrUnconfigured = isLocalDbEnabled() || !process.env.FIREBASE_PROJECT_ID;
    if (!isLocalOrUnconfigured) {
      res.status(400).json({ error: { message: 'Google Sign-In is required in Cloud mode.' } });
      return;
    }

    if (!username || !password) {
      res.status(400).json({ error: { message: 'Username and password required' } });
      return;
    }

    const hashed = hashPassword(password);
    let match = false;

    if (isLocalDbEnabled()) {
      const db = getDb();
      const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as any;
      if (row && row.password_hash === hashed) {
        match = true;
      }
    } else {
      const user = await AdminUser.findOne({ username });
      if (user && user.passwordHash === hashed) {
        match = true;
      }
    }

    if (!match) {
      res.status(401).json({ error: { message: 'Invalid admin credentials' } });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    ADMIN_SESSIONS.add(token);
    res.json({ success: true, token });
  } catch (err: any) {
    console.error('Admin login verification failed:', err.message || err);
    res.status(401).json({ error: { message: err.message || 'Authentication failed' } });
  }
});

/**
 * POST /api/admin/change-credentials
 * Secure endpoint to update admin credentials.
 */
adminRouter.post('/change-credentials', requireAdminAuth, async (req, res, next) => {
  try {
    const { newUsername, newPassword } = req.body;
    if (!newUsername || !newPassword) {
      res.status(400).json({ error: { message: 'New username and password required' } });
      return;
    }

    const hashed = hashPassword(newPassword);

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('DELETE FROM admin_users').run();
      db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(newUsername, hashed);
    } else {
      await AdminUser.deleteMany({});
      await AdminUser.create({ username: newUsername, passwordHash: hashed });
    }

    res.json({ success: true, message: 'Admin credentials updated successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/flush-logs
 * Secure endpoint to clear all request/analytics logs.
 */
adminRouter.post('/flush-logs', requireAdminAuth, async (req, res, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('DELETE FROM requests').run();
    } else {
      await RequestLog.deleteMany({});
    }
    res.json({ success: true, message: 'All request logs flushed successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/toggle-model
 * Secure endpoint to update global routing status of a model.
 */
adminRouter.post('/toggle-model', requireAdminAuth, async (req, res, next) => {
  try {
    const { modelId, platform, enabled } = req.body;
    if (!modelId || !platform || enabled === undefined) {
      res.status(400).json({ error: { message: 'Missing modelId, platform or enabled flag' } });
      return;
    }

    const enabledVal = enabled ? 1 : 0;

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('UPDATE models SET enabled = ? WHERE model_id = ? AND platform = ?')
        .run(enabledVal, modelId, platform);
    } else {
      await Model.updateOne({ modelId, platform }, { $set: { enabled: !!enabled } });
    }

    res.json({ success: true, message: `Model ${modelId} status updated successfully` });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/stats
 * Secure endpoint returning high-level system analytics, breakdowns, charts, logs, and toggles.
 */
adminRouter.get('/stats', requireAdminAuth, async (req, res, next) => {
  try {
    let system = {
      totalUsers: 0,
      totalKeys: 0,
      activeKeys: 0,
      totalRequests: 0,
      successRate: 100,
      overallCostSaved: 0,
      averageCostSavedPerRequest: 0,
      averageLatencyMs: 0,
      totalProjects: 0
    };

    let platformBreakdown: any[] = [];
    let modelBreakdown: any[] = [];
    let timeSeries: any[] = [];
    let usersList: any[] = [];
    let latencyDistribution = { fast: 0, normal: 0, slow: 0, verySlow: 0 };
    let errorBreakdown: Array<{ error: string; count: number }> = [];
    let recentLogs: any[] = [];
    let modelsCatalog: any[] = [];
    let projectsList: any[] = [];
    let projectFundingRequestsList: any[] = [];

    if (isLocalDbEnabled()) {
      const db = getDb();

      // SQLite calculations
      const usersCount = 1; // Single-user local-first DB
      const keysCountRow = db.prepare('SELECT COUNT(*) as cnt FROM api_keys').get() as { cnt: number };
      const activeKeysRow = db.prepare('SELECT COUNT(*) as cnt FROM api_keys WHERE enabled = 1 AND status = "healthy"').get() as { cnt: number };
      const totalProjectsRow = db.prepare('SELECT COUNT(*) as cnt FROM project_keys').get() as { cnt: number };
      const totalProjectsCount = totalProjectsRow?.cnt || 0;
      
      const usageRow = db.prepare(`
        SELECT 
          SUM(CASE WHEN status IN ('success', 'error') THEN 1 ELSE 0 END) as totalRequests, 
          SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successfulRequests,
          SUM(input_tokens) as totalInputTokens, 
          SUM(output_tokens) as totalOutputTokens, 
          AVG(latency_ms) as avgLatencyMs 
        FROM requests
      `).get() as any;

      const totalRequests = usageRow?.totalRequests || 0;
      const successfulRequests = usageRow?.successfulRequests || 0;
      const totalInput = usageRow?.totalInputTokens || 0;
      const totalOutput = usageRow?.totalOutputTokens || 0;
      const avgLatency = usageRow?.avgLatencyMs || 0;

      const costSaved = (totalInput * 0.0000025) + (totalOutput * 0.00001);

      system = {
        totalUsers: usersCount,
        totalKeys: keysCountRow.cnt,
        activeKeys: activeKeysRow.cnt,
        totalRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
        overallCostSaved: Number(costSaved.toFixed(4)),
        averageCostSavedPerRequest: totalRequests > 0 ? Number((costSaved / totalRequests).toFixed(6)) : 0,
        averageLatencyMs: Math.round(avgLatency),
        totalProjects: totalProjectsCount
      };

      // Platform breakdown
      const platforms = db.prepare(`
        SELECT 
          platform as _id, 
          COUNT(*) as totalRequests, 
          SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successCount,
          SUM(input_tokens) as inputTokens, 
          SUM(output_tokens) as outputTokens, 
          AVG(latency_ms) as avgLatency 
        FROM requests 
        GROUP BY platform
      `).all() as any[];

      platformBreakdown = platforms.map(p => {
        const pCost = (p.inputTokens * 0.0000025) + (p.outputTokens * 0.00001);
        return {
          platform: p._id,
          totalRequests: p.totalRequests,
          successRate: p.totalRequests > 0 ? (p.successCount / p.totalRequests) * 100 : 100,
          tokensProcessed: p.inputTokens + p.outputTokens,
          avgLatencyMs: Math.round(p.avgLatency),
          costSaved: Number(pCost.toFixed(4))
        };
      });

      // Model breakdown
      const models = db.prepare(`
        SELECT 
          model_id as _id, 
          platform, 
          COUNT(*) as totalRequests 
        FROM requests 
        GROUP BY model_id 
        ORDER BY totalRequests DESC 
        LIMIT 10
      `).all() as any[];

      modelBreakdown = models.map(m => ({
        modelId: m._id,
        platform: m.platform,
        totalRequests: m.totalRequests
      }));

      // Time Series (last 30 days)
      const times = db.prepare(`
        SELECT 
          strftime('%Y-%m-%d', created_at) as _id, 
          SUM(CASE WHEN status IN ('success', 'error') THEN 1 ELSE 0 END) as requests, 
          SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success 
        FROM requests 
        GROUP BY _id 
        ORDER BY _id ASC 
        LIMIT 30
      `).all() as any[];

      timeSeries = times.map(t => ({
        date: t._id,
        requests: t.requests,
        successRate: t.requests > 0 ? (t.success / t.requests) * 100 : 100
      }));

      // Latency Distribution
      const latencies = db.prepare(`
        SELECT 
          SUM(CASE WHEN latency_ms < 200 THEN 1 ELSE 0 END) as fast,
          SUM(CASE WHEN latency_ms >= 200 AND latency_ms < 1000 THEN 1 ELSE 0 END) as normal,
          SUM(CASE WHEN latency_ms >= 1000 AND latency_ms < 3000 THEN 1 ELSE 0 END) as slow,
          SUM(CASE WHEN latency_ms >= 3000 THEN 1 ELSE 0 END) as verySlow
        FROM requests
      `).get() as any;

      latencyDistribution = {
        fast: latencies?.fast || 0,
        normal: latencies?.normal || 0,
        slow: latencies?.slow || 0,
        verySlow: latencies?.verySlow || 0
      };

      // Error breakdown
      const errors = db.prepare(`
        SELECT error as errorVal, COUNT(*) as cnt 
        FROM requests 
        WHERE status IN ('error', 'fallback') AND error IS NOT NULL AND error != ''
        GROUP BY errorVal 
        ORDER BY cnt DESC 
        LIMIT 5
      `).all() as any[];

      errorBreakdown = errors.map(e => ({
        error: e.errorVal,
        count: e.cnt
      }));

      // Recent Logs
      const logs = db.prepare(`
        SELECT 
          created_at as createdAt, 
          platform, 
          model_id as modelId, 
          status, 
          latency_ms as latencyMs, 
          input_tokens as inputTokens, 
          output_tokens as outputTokens, 
          error 
        FROM requests 
        ORDER BY id DESC 
        LIMIT 15
      `).all() as any[];

      recentLogs = logs.map(l => ({
        ...l,
        userId: 'local-dev-user-uid',
        userEmail: 'local-dev-user@example.com'
      }));

      // Models Catalog
      const catalog = db.prepare(`
        SELECT 
          platform, 
          model_id as modelId, 
          display_name as displayName, 
          enabled 
        FROM models
      `).all() as any[];

      modelsCatalog = catalog.map(c => ({
        ...c,
        enabled: c.enabled === 1 || c.enabled === true
      }));

      // User list mock
      const localKeys = db.prepare('SELECT COUNT(*) as cnt FROM api_keys').get() as { cnt: number };
      const localErrorsRow = db.prepare("SELECT COUNT(*) as cnt FROM requests WHERE status = 'error'").get() as { cnt: number };
      const localErrors = localErrorsRow?.cnt || 0;
      usersList = [{
        userId: 'local-dev-user-uid',
        email: 'local-dev-user@example.com',
        keysCount: localKeys.cnt,
        requestsCount: totalRequests,
        tokensConsumed: totalInput + totalOutput,
        costSaved: Number(costSaved.toFixed(4)),
        errorRate: totalRequests > 0 ? Number(((localErrors / totalRequests) * 100).toFixed(1)) : 0
      }];

      // Projects list
      const projectsQuery = `
        SELECT 
          pk.id,
          pk.name,
          pk.project_key,
          pk.format,
          pk.enabled,
          pk.is_promoted,
          pk.project_link,
          pk.created_at,
          COUNT(r.id) as total_requests,
          SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as success_requests,
          SUM(CASE WHEN r.status = 'error' THEN 1 ELSE 0 END) as error_requests,
          SUM(IFNULL(r.input_tokens, 0) + IFNULL(r.output_tokens, 0)) as total_tokens,
          AVG(r.latency_ms) as avg_latency,
          MAX(r.created_at) as last_used_at
        FROM project_keys pk
        LEFT JOIN requests r ON r.project_key = pk.project_key
        GROUP BY pk.id
        ORDER BY pk.created_at DESC
      `;
      const projRows = db.prepare(projectsQuery).all() as any[];
      projectsList = projRows.map(r => {
        const totalRequests = r.total_requests ?? 0;
        const successRequests = r.success_requests ?? 0;
        const errorRequests = r.error_requests ?? 0;
        const successRate = totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100 * 10) / 10 : 100;
        const errorRate = totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 100 * 10) / 10 : 0;
        return {
          id: r.id.toString(),
          name: r.name,
          projectKey: r.project_key,
          format: r.format,
          enabled: r.enabled === 1,
          isPromoted: r.is_promoted === 1,
          projectLink: r.project_link || '',
          allowVision: r.allow_vision === 1,
          allowVoice: r.allow_voice === 1,
          allowTTS: r.allow_tts === 1,
          allowImageGen: r.allow_image_gen === 1,
          createdAt: r.created_at,
          userEmail: 'local-dev-user@example.com',
          metrics: {
            totalRequests,
            successRate,
            errorRate,
            totalTokens: r.total_tokens ?? 0,
            avgLatencyMs: Math.round(r.avg_latency ?? 0),
            lastUsedAt: r.last_used_at || null,
          }
        };
      });

      // Project funding requests list (SQLite)
      try {
        const rows = db.prepare('SELECT * FROM promo_project_requests ORDER BY created_at DESC').all() as any[];
        projectFundingRequestsList = rows.map(r => ({
          id: r.id.toString(),
          userId: r.user_id,
          userEmail: r.user_email,
          projectKeyId: r.project_key_id,
          projectName: r.project_name,
          projectKey: r.project_key,
          format: r.format,
          projectLink: r.project_link,
          remarks: r.remarks,
          status: r.status,
          poolUpgrade: r.pool_upgrade === 1,
          allowVision: r.allow_vision === 1,
          allowVoice: r.allow_voice === 1,
          allowTTS: r.allow_tts === 1,
          allowImageGen: r.allow_image_gen === 1,
          approvedPoolUpgrade: r.approved_pool_upgrade === 1,
          approvedAllowVision: r.approved_allow_vision === 1,
          approvedAllowVoice: r.approved_allow_voice === 1,
          approvedAllowTTS: r.approved_allow_tts === 1,
          approvedAllowImageGen: r.approved_allow_image_gen === 1,
          createdAt: r.created_at
        }));
      } catch (err: any) {
        console.warn('[SQLite] Failed to query promo project requests:', err.message || err);
      }

    } else {
      // MongoDB calculations
      const totalUsers = await UserSettings.countDocuments();
      const totalKeys = await ApiKey.countDocuments();
      const activeKeys = await ApiKey.countDocuments({ enabled: true, status: 'healthy' });
      const totalProjects = await ProjectKey.countDocuments();

      const requestStats = await RequestLog.aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: { $cond: [{ $in: ['$status', ['success', 'error']] }, 1, 0] } },
            successfulRequests: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' },
            avgLatencyMs: { $avg: '$latencyMs' }
          }
        }
      ]);

      const globalUsage = requestStats[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        avgLatencyMs: 0
      };

      const totalRequests = globalUsage.totalRequests;
      const costSaved = (globalUsage.totalInputTokens * 0.0000025) + (globalUsage.totalOutputTokens * 0.00001);

      system = {
        totalUsers,
        totalKeys,
        activeKeys,
        totalRequests,
        successRate: totalRequests > 0 ? (globalUsage.successfulRequests / totalRequests) * 100 : 100,
        overallCostSaved: Number(costSaved.toFixed(4)),
        averageCostSavedPerRequest: totalRequests > 0 ? Number((costSaved / totalRequests).toFixed(6)) : 0,
        averageLatencyMs: Math.round(globalUsage.avgLatencyMs),
        totalProjects
      };

      // Platform Breakdown
      const platforms = await RequestLog.aggregate([
        {
          $group: {
            _id: '$platform',
            totalRequests: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            avgLatency: { $avg: '$latencyMs' }
          }
        }
      ]);

      platformBreakdown = platforms.map(p => {
        const pCost = (p.inputTokens * 0.0000025) + (p.outputTokens * 0.00001);
        return {
          platform: p._id,
          totalRequests: p.totalRequests,
          successRate: p.totalRequests > 0 ? (p.successCount / p.totalRequests) * 100 : 100,
          tokensProcessed: p.inputTokens + p.outputTokens,
          avgLatencyMs: Math.round(p.avgLatency),
          costSaved: Number(pCost.toFixed(4))
        };
      });

      // Model Breakdown
      const models = await RequestLog.aggregate([
        {
          $group: {
            _id: '$modelId',
            platform: { $first: '$platform' },
            totalRequests: { $sum: 1 }
          }
        },
        { $sort: { totalRequests: -1 } },
        { $limit: 10 }
      ]);

      modelBreakdown = models.map(m => ({
        modelId: m._id,
        platform: m.platform,
        totalRequests: m.totalRequests
      }));

      // Time Series
      const times = await RequestLog.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            requests: { $sum: { $cond: [{ $in: ['$status', ['success', 'error']] }, 1, 0] } },
            success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ]);

      timeSeries = times.map(t => ({
        date: t._id,
        requests: t.requests,
        successRate: t.requests > 0 ? (t.success / t.requests) * 100 : 100
      }));

      // Latency Distribution
      const latencyStats = await RequestLog.aggregate([
        {
          $group: {
            _id: null,
            fast: { $sum: { $cond: [{ $lt: ['$latencyMs', 200] }, 1, 0] } },
            normal: { $sum: { $cond: [{ $and: [{ $gte: ['$latencyMs', 200] }, { $lt: ['$latencyMs', 1000] }] }, 1, 0] } },
            slow: { $sum: { $cond: [{ $and: [{ $gte: ['$latencyMs', 1000] }, { $lt: ['$latencyMs', 3000] }] }, 1, 0] } },
            verySlow: { $sum: { $cond: [{ $gte: ['$latencyMs', 3000] }, 1, 0] } }
          }
        }
      ]);
      latencyDistribution = latencyStats[0] || { fast: 0, normal: 0, slow: 0, verySlow: 0 };

      const errList = await RequestLog.aggregate([
        { $match: { status: { $in: ['error', 'fallback'] }, error: { $nin: [null, ''] } } },
        { $group: { _id: '$error', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      errorBreakdown = errList.map(e => ({
        error: e._id,
        count: e.count
      }));

      // Recent Logs
      const logs = await RequestLog.find()
        .sort({ createdAt: -1 })
        .limit(15)
        .lean();
      const uniqueUserIds = Array.from(new Set(logs.map((l: any) => l.userId).filter(Boolean)));
      const userSettingsList = await UserSettings.find({ userId: { $in: uniqueUserIds } }).lean();
      const emailMap = new Map(userSettingsList.map((u: any) => [u.userId, u.email]));

      recentLogs = logs.map((l: any) => ({
        createdAt: l.createdAt,
        platform: l.platform,
        modelId: l.modelId,
        status: l.status,
        latencyMs: l.latencyMs,
        inputTokens: l.inputTokens,
        outputTokens: l.outputTokens,
        error: l.error,
        userId: l.userId,
        userEmail: emailMap.get(l.userId) || l.userId || 'unknown-user'
      }));

      // Models Catalog
      const catalog = await Model.find({}, { platform: 1, modelId: 1, displayName: 1, enabled: 1 }).lean();
      modelsCatalog = catalog.map((c: any) => ({
        platform: c.platform,
        modelId: c.modelId,
        displayName: c.displayName,
        enabled: !!c.enabled
      }));

      // User List (MongoDB lookup)
      const users = await UserSettings.aggregate([
        {
          $lookup: {
            from: 'apikeys',
            localField: 'userId',
            foreignField: 'userId',
            as: 'keys'
          }
        },
        {
          $lookup: {
            from: 'requestlogs',
            localField: 'userId',
            foreignField: 'userId',
            as: 'logs'
          }
        },
        {
          $project: {
            userId: 1,
            email: 1,
            keysCount: { $size: '$keys' },
            requestsCount: { $size: '$logs' },
            errorsCount: {
              $size: {
                $filter: {
                  input: '$logs',
                  as: 'log',
                  cond: { $eq: ['$$log.status', 'error'] }
                }
              }
            },
            tokensConsumed: {
              $sum: {
                $map: {
                  input: '$logs',
                  as: 'log',
                  in: { $add: ['$$log.inputTokens', '$$log.outputTokens'] }
                }
              }
            },
            costSaved: {
              $sum: {
                $map: {
                  input: '$logs',
                  as: 'log',
                  in: {
                    $add: [
                      { $multiply: ['$$log.inputTokens', 0.0000025] },
                      { $multiply: ['$$log.outputTokens', 0.000010] }
                    ]
                  }
                }
              }
            }
          }
        },
        { $sort: { requestsCount: -1 } }
      ]);

      usersList = users.map(u => ({
        ...u,
        costSaved: Number(u.costSaved.toFixed(4)),
        errorRate: u.requestsCount > 0 ? Number(((u.errorsCount || 0) / u.requestsCount * 100).toFixed(1)) : 0
      }));

      // Projects list (MongoDB lookup)
      const allProjectKeys = await ProjectKey.find().sort({ createdAt: -1 }).lean();
      const uniqueProjectUserIds = Array.from(new Set(allProjectKeys.map(pk => pk.userId)));
      const projectUserSettings = await UserSettings.find({ userId: { $in: uniqueProjectUserIds } }).lean();
      const projectUserEmailMap = new Map(projectUserSettings.map((u: any) => [u.userId, u.email]));

      for (const pk of allProjectKeys) {
        const stats = await RequestLog.aggregate([
          { $match: { projectKey: pk.projectKey } },
          {
            $group: {
              _id: null,
              totalRequests: { $sum: 1 },
              successRequests: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
              errorRequests: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
              totalTokens: { $sum: { $add: [{ $ifNull: ['$inputTokens', 0] }, { $ifNull: ['$outputTokens', 0] }] } },
              avgLatency: { $avg: '$latencyMs' },
              lastUsedAt: { $max: '$createdAt' }
            }
          }
        ]);
        const s = stats[0] || {
          totalRequests: 0,
          successRequests: 0,
          errorRequests: 0,
          totalTokens: 0,
          avgLatency: 0,
          lastUsedAt: null
        };
        const totalRequests = s.totalRequests ?? 0;
        const successRequests = s.successRequests ?? 0;
        const errorRequests = s.errorRequests ?? 0;
        const successRate = totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100 * 10) / 10 : 100;
        const errorRate = totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 100 * 10) / 10 : 0;

        projectsList.push({
          id: pk._id.toString(),
          name: pk.name,
          projectKey: pk.projectKey,
          format: pk.format,
          enabled: !!pk.enabled,
          isPromoted: !!pk.isPromoted,
          projectLink: pk.projectLink || '',
          allowVision: !!pk.allowVision,
          allowVoice: !!pk.allowVoice,
          allowTTS: !!pk.allowTTS,
          allowImageGen: !!pk.allowImageGen,
          createdAt: pk.createdAt,
          userEmail: projectUserEmailMap.get(pk.userId) || pk.userId || 'unknown-user',
          metrics: {
            totalRequests,
            successRate,
            errorRate,
            totalTokens: s.totalTokens ?? 0,
            avgLatencyMs: Math.round(s.avgLatency ?? 0),
            lastUsedAt: s.lastUsedAt || null,
          }
        });
      }
    }

    let adminEmails: { email: string; isFundingProvider: boolean }[] = [];
    let promoUsersList: any[] = [];

    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare('SELECT email, is_funding_provider FROM admin_emails ORDER BY created_at DESC').all() as any[];
      adminEmails = rows.map(r => ({ email: r.email, isFundingProvider: r.is_funding_provider === 1 }));
    } else {
      const rows = await AdminEmail.find().sort({ createdAt: -1 });
      adminEmails = rows.map(r => ({ email: r.email, isFundingProvider: !!r.isFundingProvider }));

      try {
        const promoUsers = await PromoUser.find().lean();
        const promoStats = await RequestLog.aggregate([
          { $match: { fundedByUserId: { $ne: null } } },
          {
            $group: {
              _id: '$userId',
              inputTokens: { $sum: '$inputTokens' },
              outputTokens: { $sum: '$outputTokens' },
              requestsCount: { $sum: 1 }
            }
          }
        ]);
        const promoStatsMap = new Map(promoStats.map(s => [s._id?.toString() || '', s]));

        promoUsersList = promoUsers.map((p: any) => {
          const stats = promoStatsMap.get(p.userId?.toString() || '') || { inputTokens: 0, outputTokens: 0, requestsCount: 0 };
          return {
            userId: p.userId,
            email: p.email,
            tokensUsed: p.tokensUsed,
            tokensLimit: p.tokensLimit,
            createdAt: p.createdAt,
            inputTokens: stats.inputTokens,
            outputTokens: stats.outputTokens,
            requestsCount: stats.requestsCount,
          };
        });
      } catch (err) {
        console.error('Failed to aggregate promo user stats:', err);
      }

      // Project funding requests list (MongoDB)
      try {
        const rows = await PromoProjectRequest.find().sort({ createdAt: -1 });
        projectFundingRequestsList = rows.map(r => ({
          id: r._id.toString(),
          userId: r.userId,
          userEmail: r.userEmail,
          projectKeyId: r.projectKeyId,
          projectName: r.projectName,
          projectKey: r.projectKey,
          format: r.format,
          projectLink: r.projectLink,
          remarks: r.remarks,
          status: r.status,
          poolUpgrade: !!r.poolUpgrade,
          allowVision: !!r.allowVision,
          allowVoice: !!r.allowVoice,
          allowTTS: !!r.allowTTS,
          allowImageGen: !!r.allowImageGen,
          approvedPoolUpgrade: !!r.approvedPoolUpgrade,
          approvedAllowVision: !!r.approvedAllowVision,
          approvedAllowVoice: !!r.approvedAllowVoice,
          approvedAllowTTS: !!r.approvedAllowTTS,
          approvedAllowImageGen: !!r.approvedAllowImageGen,
          createdAt: r.createdAt.toISOString()
        }));
      } catch (err: any) {
        console.error('[MongoDB] Failed to query promo project requests:', err.message || err);
      }
    }

    res.json({
      success: true,
      system,
      platformBreakdown,
      modelBreakdown,
      timeSeries,
      latencyDistribution,
      errorBreakdown,
      recentLogs,
      modelsCatalog,
      users: usersList,
      adminEmails,
      promoUsers: promoUsersList,
      projects: projectsList,
      projectFundingRequests: projectFundingRequestsList
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/emails
 * Secure endpoint to get all authorized admin emails.
 */
adminRouter.get('/emails', requireAdminAuth, async (req, res, next) => {
  try {
    let emails: { email: string; isFundingProvider: boolean }[] = [];
    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare('SELECT email, is_funding_provider FROM admin_emails ORDER BY created_at DESC').all() as any[];
      emails = rows.map(r => ({ email: r.email, isFundingProvider: r.is_funding_provider === 1 }));
    } else {
      const rows = await AdminEmail.find().sort({ createdAt: -1 });
      emails = rows.map(r => ({ email: r.email, isFundingProvider: !!r.isFundingProvider }));
    }
    res.json({ success: true, emails });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/emails/toggle-funding
 * Secure endpoint to toggle whether an admin account acts as a promo funding provider.
 */
adminRouter.post('/emails/toggle-funding', requireAdminAuth, async (req, res, next) => {
  try {
    const { email, isFundingProvider } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('UPDATE admin_emails SET is_funding_provider = ? WHERE LOWER(email) = LOWER(?)')
        .run(isFundingProvider ? 1 : 0, cleanEmail);
    } else {
      await AdminEmail.updateOne(
        { email: cleanEmail },
        { isFundingProvider: !!isFundingProvider }
      );
    }
    res.json({ success: true, message: 'Funding provider status updated successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/emails
 * Secure endpoint to add a new admin email.
 */
adminRouter.post('/emails', requireAdminAuth, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    
    if (cleanEmail.length === 0) {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('INSERT OR IGNORE INTO admin_emails (email) VALUES (?)').run(cleanEmail);
    } else {
      await AdminEmail.findOneAndUpdate(
        { email: cleanEmail },
        { email: cleanEmail },
        { upsert: true, new: true }
      );
    }
    res.json({ success: true, message: 'Admin email added successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/emails
 * Secure endpoint to remove an admin email.
 */
adminRouter.delete('/emails', requireAdminAuth, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    // Prevent deleting the last admin email to avoid getting locked out
    let totalCount = 0;
    if (isLocalDbEnabled()) {
      const db = getDb();
      const row = db.prepare('SELECT COUNT(*) as count FROM admin_emails').get() as { count: number };
      totalCount = row.count;
    } else {
      totalCount = await AdminEmail.countDocuments();
    }

    if (totalCount <= 1) {
      res.status(400).json({ error: { message: 'Cannot delete the last admin email. At least one admin must exist.' } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('DELETE FROM admin_emails WHERE LOWER(email) = LOWER(?)').run(cleanEmail);
    } else {
      await AdminEmail.deleteOne({ email: cleanEmail });
    }
    res.json({ success: true, message: 'Admin email removed successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/promo/:userId
 * Secure endpoint to remove a user from the promotional pool.
 */
adminRouter.delete('/promo/:userId', requireAdminAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (isLocalDbEnabled()) {
      res.status(400).json({ error: { message: 'Promo pool management is only available in cloud database mode' } });
      return;
    }
    await PromoUser.deleteOne({ userId });
    res.json({ success: true, message: 'User removed from promo pool successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Secure endpoint to completely delete a user's account and associated keys.
 */
adminRouter.delete('/users/:userId', requireAdminAuth, async (req: Request, res: Response, next) => {
  try {
    const { userId } = req.params;
    if (isLocalDbEnabled()) {
      res.status(400).json({ error: { message: 'User management is only available in cloud database mode' } });
      return;
    }

    // 1. Delete database records
    await UserSettings.deleteOne({ userId });
    await ApiKey.deleteMany({ userId });
    await PromoUser.deleteOne({ userId });

    // 2. Delete Firebase Auth user
    try {
      await admin.auth().deleteUser(String(userId));
    } catch (err: any) {
      console.warn(`[Admin] Failed to delete Firebase Auth user ${userId}:`, err.message);
    }

    res.json({ success: true, message: 'User account and configurations deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/project-funding/:id/approve
 * Secure endpoint to approve a project funding request.
 */
adminRouter.post('/project-funding/:id/approve', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    let userId = '';
    let userEmail = '';

    if (isLocalDbEnabled()) {
      const db = getDb();
      const request = db.prepare('SELECT user_id, user_email, project_key_id, pool_upgrade, allow_vision, allow_voice, allow_tts, allow_image_gen FROM promo_project_requests WHERE id = ?').get(id) as any;
      if (!request) {
        res.status(404).json({ error: { message: 'Funding request not found' } });
        return;
      }
      userId = request.user_id;
      userEmail = request.user_email;

      // Determine approved permissions (defaulting to request values if body fields are not provided)
      let approvedPoolUpgrade = req.body.poolUpgrade;
      let approvedAllowVision = req.body.allowVision;
      let approvedAllowVoice = req.body.allowVoice;
      let approvedAllowTTS = req.body.allowTTS;
      let approvedAllowImageGen = req.body.allowImageGen;

      if (approvedPoolUpgrade === undefined && approvedAllowVision === undefined && approvedAllowVoice === undefined && approvedAllowTTS === undefined && approvedAllowImageGen === undefined) {
        approvedPoolUpgrade = request.pool_upgrade === 1;
        approvedAllowVision = request.allow_vision === 1;
        approvedAllowVoice = request.allow_voice === 1;
        approvedAllowTTS = request.allow_tts === 1;
        approvedAllowImageGen = request.allow_image_gen === 1;
      } else {
        approvedPoolUpgrade = !!approvedPoolUpgrade;
        approvedAllowVision = !!approvedAllowVision;
        approvedAllowVoice = !!approvedAllowVoice;
        approvedAllowTTS = !!approvedAllowTTS;
        approvedAllowImageGen = !!approvedAllowImageGen;
      }

      db.prepare(`
        UPDATE promo_project_requests 
        SET status = 'approved',
            approved_pool_upgrade = ?,
            approved_allow_vision = ?,
            approved_allow_voice = ?,
            approved_allow_tts = ?,
            approved_allow_image_gen = ?
        WHERE id = ?
      `).run(
        approvedPoolUpgrade ? 1 : 0,
        approvedAllowVision ? 1 : 0,
        approvedAllowVoice ? 1 : 0,
        approvedAllowTTS ? 1 : 0,
        approvedAllowImageGen ? 1 : 0,
        id
      );

      // Preserve previously granted permissions via CASE WHEN
      db.prepare(`
        UPDATE project_keys
        SET is_promoted = CASE WHEN ? = 1 THEN 1 ELSE is_promoted END,
            allow_vision = CASE WHEN ? = 1 THEN 1 ELSE allow_vision END,
            allow_voice = CASE WHEN ? = 1 THEN 1 ELSE allow_voice END,
            allow_tts = CASE WHEN ? = 1 THEN 1 ELSE allow_tts END,
            allow_image_gen = CASE WHEN ? = 1 THEN 1 ELSE allow_image_gen END
        WHERE id = ?
      `).run(
        approvedPoolUpgrade ? 1 : 0,
        approvedAllowVision ? 1 : 0,
        approvedAllowVoice ? 1 : 0,
        approvedAllowTTS ? 1 : 0,
        approvedAllowImageGen ? 1 : 0,
        request.project_key_id
      );

    } else {
      const request = await PromoProjectRequest.findById(id);
      if (!request) {
        res.status(404).json({ error: { message: 'Funding request not found' } });
        return;
      }
      userId = request.userId;
      userEmail = request.userEmail;

      // Determine approved permissions (defaulting to request values if body fields are not provided)
      let approvedPoolUpgrade = req.body.poolUpgrade;
      let approvedAllowVision = req.body.allowVision;
      let approvedAllowVoice = req.body.allowVoice;
      let approvedAllowTTS = req.body.allowTTS;
      let approvedAllowImageGen = req.body.allowImageGen;

      if (approvedPoolUpgrade === undefined && approvedAllowVision === undefined && approvedAllowVoice === undefined && approvedAllowTTS === undefined && approvedAllowImageGen === undefined) {
        approvedPoolUpgrade = !!request.poolUpgrade;
        approvedAllowVision = !!request.allowVision;
        approvedAllowVoice = !!request.allowVoice;
        approvedAllowTTS = !!request.allowTTS;
        approvedAllowImageGen = !!request.allowImageGen;
      } else {
        approvedPoolUpgrade = !!approvedPoolUpgrade;
        approvedAllowVision = !!approvedAllowVision;
        approvedAllowVoice = !!approvedAllowVoice;
        approvedAllowTTS = !!approvedAllowTTS;
        approvedAllowImageGen = !!approvedAllowImageGen;
      }

      request.status = 'approved';
      request.approvedPoolUpgrade = approvedPoolUpgrade;
      request.approvedAllowVision = approvedAllowVision;
      request.approvedAllowVoice = approvedAllowVoice;
      request.approvedAllowTTS = approvedAllowTTS;
      request.approvedAllowImageGen = approvedAllowImageGen;
      await request.save();

      // Update project key permissions
      const pkObj = await ProjectKey.findById(request.projectKeyId);
      if (pkObj) {
        if (approvedPoolUpgrade) pkObj.isPromoted = true;
        if (approvedAllowVision) pkObj.allowVision = true;
        if (approvedAllowVoice) pkObj.allowVoice = true;
        if (approvedAllowTTS) pkObj.allowTTS = true;
        if (approvedAllowImageGen) pkObj.allowImageGen = true;
        await pkObj.save();
      }

      // Upgrade tokensLimit in PromoUser if pool upgrade approved
      if (approvedPoolUpgrade) {
        await PromoUser.findOneAndUpdate(
          { userId },
          { 
            userId, 
            email: userEmail,
            tokensLimit: 100000000 // 100 Million
          },
          { upsert: true, new: true }
        );
      }
    }

    res.json({ success: true, message: 'Project funding request approved successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/project-funding/:id/reject
 * Secure endpoint to reject a project funding request.
 */
adminRouter.post('/project-funding/:id/reject', requireAdminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isLocalDbEnabled()) {
      const db = getDb();
      const result = db.prepare("UPDATE promo_project_requests SET status = 'rejected' WHERE id = ?").run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: { message: 'Funding request not found' } });
        return;
      }
    } else {
      const request = await PromoProjectRequest.findById(id);
      if (!request) {
        res.status(404).json({ error: { message: 'Funding request not found' } });
        return;
      }
      request.status = 'rejected';
      await request.save();
    }

    res.json({ success: true, message: 'Project funding request rejected' });
  } catch (err) {
    next(err);
  }
});
