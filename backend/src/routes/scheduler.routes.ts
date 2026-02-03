import { Router } from 'express';
import { getStatus, runWorkflow, getSchedules, addSchedule, removeSchedule } from '../controllers/scheduler.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protezione multi-tenant
router.use(authMiddleware);

router.get('/status', getStatus);
router.post('/run', runWorkflow);

// Gestione Schedulazione Dinamica
router.get('/schedules', getSchedules);
router.post('/schedules', addSchedule);
router.delete('/schedules', removeSchedule);

export default router;
