import { Router } from 'express';
import { LogController } from '../controllers/log.controller';

const router = Router();

// GET /api/logs
router.get('/', LogController.getLogs);

// GET /api/logs/stats
router.get('/stats', LogController.getLatestWorkflowStats);

export default router;

