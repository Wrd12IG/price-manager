import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

// GET /api/logs
router.get('/', LogController.getLogs);

// GET /api/logs/stats
router.get('/stats', LogController.getLatestWorkflowStats);

// GET /api/logs/analytics
router.get('/analytics', LogController.getLogAnalytics);

export default router;

