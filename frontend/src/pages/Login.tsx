import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Container,
    Avatar,
    InputAdornment,
    IconButton
} from '@mui/material';
import {
    LockOutlined as LockIcon,
    Visibility,
    VisibilityOff,
    Login as LoginIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/auth/login', formData);

            // Usa il context per login
            login(
                res.data.accessToken || res.data.token,
                res.data.refreshToken || '',
                res.data.user
            );

            toast.success('Accesso effettuato!');

            // Reindirizza l'admin direttamente al pannello admin
            if (res.data.user.ruolo === 'admin') {
                navigate('/admin', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Errore durante il login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
        >
            <Container maxWidth="xs">
                <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 4, boxShadow: 10 }}>
                    <Avatar sx={{ m: 1, bgcolor: '#000', color: '#FFD700', width: 56, height: 56 }}>
                        <LockIcon fontSize="large" />
                    </Avatar>
                    <Typography component="h1" variant="h5" fontWeight="bold" gutterBottom>
                        Price Manager Login
                    </Typography>
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
                        Accedi con le tue credenziali WR Digital
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Indirizzo Email"
                            autoComplete="email"
                            autoFocus
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={loading}
                            sx={{ mt: 3, mb: 2, py: 1.5, background: '#000', '&:hover': { background: '#333' } }}
                            startIcon={<LoginIcon sx={{ color: '#FFD700' }} />}
                        >
                            {loading ? 'Accesso in corso...' : 'Entra nel sistema'}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default Login;
