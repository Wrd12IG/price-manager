import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
    res.json({ success: true, token: 'demo-token', message: 'Da implementare' });
});

router.post('/register', (req, res) => {
    res.json({ success: true, message: 'Da implementare' });
});

export default router;
