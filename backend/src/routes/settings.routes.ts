import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/settings.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

export default router;
