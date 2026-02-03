import { Router } from 'express';
import { getUserJobs, getActiveJobs, getJobStatus, streamJobUpdates } from '../controllers/jobs.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Tutte le rotte richiedono autenticazione
router.use(authMiddleware);

router.get('/', getUserJobs);
router.get('/active', getActiveJobs);
router.get('/:id', getJobStatus);
router.get('/:id/stream', streamJobUpdates);

export default router;
