import { Router } from 'express';
import { requireDashboardAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { UserSettings } from '../models/UserSettings.js';
import { ApiKey } from '../models/ApiKey.js';
import { RequestLog } from '../models/RequestLog.js';

export const adminRouter = Router();

// Apply auth middleware to all admin endpoints
adminRouter.use(requireDashboardAuth);

/**
 * GET /api/admin/stats
 * Aggregates and returns high-level system metrics and detailed per-user usage summaries.
 */
adminRouter.get('/stats', async (req: AuthenticatedRequest, res, next) => {
  try {
    // 1. High-level counts
    const totalUsers = await UserSettings.countDocuments();
    const totalKeys = await ApiKey.countDocuments();
    const activeKeys = await ApiKey.countDocuments({ enabled: true, status: 'healthy' });

    // 2. Aggregate request logs
    const requestStats = await RequestLog.aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          failedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
          },
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          avgLatencyMs: { $avg: '$latencyMs' }
        }
      }
    ]);

    const globalUsage = requestStats[0] || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      avgLatencyMs: 0
    };

    // 3. Aggregate detailed statistics per user
    const usersSummary = await UserSettings.aggregate([
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
          createdAt: 1,
          unifiedApiKey: 1,
          keysCount: { $size: '$keys' },
          activeKeysCount: {
            $size: {
              $filter: {
                input: '$keys',
                as: 'key',
                cond: {
                  $and: [
                    { $eq: ['$$key.enabled', true] },
                    { $eq: ['$$key.status', 'healthy'] }
                  ]
                }
              }
            }
          },
          requestsCount: { $size: '$logs' },
          successfulRequestsCount: {
            $size: {
              $filter: {
                input: '$logs',
                as: 'log',
                cond: { $eq: ['$$log.status', 'success'] }
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
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    // Mask the secret unified keys for security before returning
    const safeUsersSummary = usersSummary.map(user => ({
      ...user,
      unifiedApiKey: user.unifiedApiKey 
        ? `${user.unifiedApiKey.substring(0, 12)}...${user.unifiedApiKey.substring(user.unifiedApiKey.length - 4)}` 
        : 'none'
    }));

    res.json({
      success: true,
      system: {
        totalUsers,
        totalKeys,
        activeKeys,
        globalUsage
      },
      users: safeUsersSummary
    });
  } catch (error) {
    next(error);
  }
});
