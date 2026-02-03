import { Router } from 'express';
import {
    getAllUsers,
    createUser,
    updateUserStatus,
    getGlobalStats,
    getSystemLogs,
    deleteUser,
    getSystemHealth,
    updateGlobalSettings
} from '../controllers/admin.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// Tutte le rotte admin richiedono autenticazione e ruolo Admin
router.use(authMiddleware);
router.use(adminOnly);

router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/stats', getGlobalStats);
router.get('/health', getSystemHealth);
router.post('/settings', updateGlobalSettings);
router.get('/logs', getSystemLogs);

export default router;
