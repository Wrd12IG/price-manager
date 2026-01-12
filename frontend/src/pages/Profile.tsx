import { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Divider,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Save as SaveIcon,
    Person as PersonIcon,
    Notifications as NotificationsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

interface ProfileData {
    nome: string;
    cognome: string;
    email: string;
    notificationEmail: string;
}

export default function Profile() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<ProfileData>({
        nome: '',
        cognome: '',
        email: '',
        notificationEmail: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await axios.get('/api/settings/profile');
            const { user, settings } = response.data.data;
            setFormData({
                nome: user.nome || '',
                cognome: user.cognome || '',
                email: user.email || '',
                notificationEmail: settings.notificationEmail || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Errore durante il caricamento del profilo');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSave = async () => {
        if (!formData.email) {
            toast.error('L\'email utente è obbligatoria');
            return;
        }

        setSaving(true);
        try {
            await axios.put('/api/settings/profile', formData);
            toast.success('Profilo aggiornato con successo');
        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast.error(error.response?.data?.message || 'Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box maxWidth="md" sx={{ mx: 'auto', mt: 4 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    Il mio Profilo
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Gestisci le tue informazioni personali e le preferenze di notifica
                </Typography>
            </Box>

            <Paper sx={{ p: 4, mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <PersonIcon sx={{ fontSize: 28, mr: 1.5, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                        Informazioni Personali
                    </Typography>
                </Box>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Nome"
                            name="nome"
                            value={formData.nome}
                            onChange={handleChange}
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Cognome"
                            name="cognome"
                            value={formData.cognome}
                            onChange={handleChange}
                            variant="outlined"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Email Utente"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            variant="outlined"
                            helperText="Questa email viene utilizzata per l'accesso (se implementato) e come riferimento principale."
                        />
                    </Grid>
                </Grid>

                <Box sx={{ my: 4 }}>
                    <Divider />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <NotificationsIcon sx={{ fontSize: 28, mr: 1.5, color: 'secondary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                        Preferenze Notifiche
                    </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                    Inserisci l'indirizzo email dove vuoi ricevere i report automatici del Workflow (Importazione, Arricchimento, Sync).
                </Alert>

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Email per Report Automatici"
                            name="notificationEmail"
                            type="email"
                            value={formData.notificationEmail}
                            onChange={handleChange}
                            variant="outlined"
                            placeholder="esempio: report@wrdigital.it"
                        />
                    </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon sx={{ color: '#FFD700' }} />}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}
