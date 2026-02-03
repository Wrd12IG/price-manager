import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Switch,
    Chip,
    Avatar,
    Tooltip,
    LinearProgress,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    IconButton,
    Collapse,
    Divider,
    Divider as MuiDivider
} from '@mui/material';
import {
    People as PeopleIcon,
    Inventory as InventoryIcon,
    Terminal as TerminalIcon,
    AdminPanelSettings as AdminIcon,
    Refresh as RefreshIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Delete as DeleteIcon,
    PersonAdd as PersonAddIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Dns as ServerIcon,
    Memory as MemoryIcon,
    Storage as StorageIcon,
    Settings as SettingsIcon,
    AppShortcut as AppIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

const AdminPanel: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [health, setHealth] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<number | null>(null);

    // Gestione Impostazioni Globali
    const [globalSettings, setGlobalSettings] = useState({
        GEMINI_API_KEY: '',
        OPENAI_API_KEY: ''
    });
    const [savingSettings, setSavingSettings] = useState(false);

    // Form nuovo utente
    const [showNewUserForm, setShowNewUserForm] = useState(false);
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        nome: '',
        cognome: '',
        ruolo: 'merchant'
    });
    const [creating, setCreating] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return { Authorization: `Bearer ${token}` };
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const headers = getHeaders();
            const [statsRes, usersRes, logsRes, healthRes, profileRes] = await Promise.all([
                axios.get(`${API_URL}/admin/stats`, { headers }),
                axios.get(`${API_URL}/admin/users`, { headers }),
                axios.get(`${API_URL}/admin/logs`, { headers }),
                axios.get(`${API_URL}/admin/health`, { headers }),
                axios.get(`${API_URL}/settings/profile`, { headers })
            ]);

            setStats(statsRes.data.data);
            setUsers(usersRes.data.data);
            setLogs(logsRes.data.data);
            setHealth(healthRes.data.data);

            // Impostazioni globali dal profilo (se l'utente è admin le ha tutte)
            const settings = profileRes.data.data.settings;
            setGlobalSettings({
                GEMINI_API_KEY: settings.GEMINI_API_KEY || '',
                OPENAI_API_KEY: settings.OPENAI_API_KEY || ''
            });

        } catch (err) {
            toast.error('Errore nel caricamento dei dati amministrativi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleUserStatus = async (id: number, currentStatus: boolean) => {
        try {
            await axios.put(`${API_URL}/admin/users/${id}`, { attivo: !currentStatus }, { headers: getHeaders() });
            toast.success('Stato utente aggiornato');
            setUsers(prev => prev.map(u => u.id === id ? { ...u, attivo: !currentStatus } : u));
        } catch (err) {
            toast.error('Errore durante l\'aggiornamento');
        }
    };

    const handleSaveGlobalSettings = async () => {
        setSavingSettings(true);
        try {
            await axios.post(`${API_URL}/admin/settings`, globalSettings, { headers: getHeaders() });
            toast.success('Impostazioni globali salvate con successo');
        } catch (err) {
            toast.error('Errore nel salvataggio delle impostazioni');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleOpenDeleteDialog = (id: number) => {
        setUserToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setUserToDelete(null);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await axios.delete(`${API_URL}/admin/users/${userToDelete}`, { headers: getHeaders() });
            toast.success('Utente eliminato definitivamente');
            setUsers(prev => prev.filter(u => u.id !== userToDelete));
            handleCloseDeleteDialog();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Errore durante l\'eliminazione');
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.email || !newUser.password || !newUser.nome || !newUser.cognome) {
            toast.error('Compila tutti i campi obbligatori');
            return;
        }

        setCreating(true);
        try {
            const res = await axios.post(`${API_URL}/admin/users`, newUser, { headers: getHeaders() });
            toast.success(`Utente ${newUser.email} creato con successo!`);
            setUsers(prev => [...prev, res.data.data]);
            setNewUser({ email: '', password: '', nome: '', cognome: '', ruolo: 'merchant' });
            setShowNewUserForm(false);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Errore durante la creazione');
        } finally {
            setCreating(false);
        }
    };

    if (loading && !stats) return <LinearProgress />;

    return (
        <Box p={3} sx={{ maxWidth: '1400px', margin: '0 auto' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-1px' }}>
                        🛡️ Pannello Amministrativo
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Gestione globale della piattaforma, merchant e salute del sistema
                    </Typography>
                </Box>
                <Button
                    startIcon={<RefreshIcon />}
                    variant="contained"
                    onClick={fetchData}
                    disabled={loading}
                    sx={{ borderRadius: '12px', bgcolor: '#000', '&:hover': { bgcolor: '#333' } }}
                >
                    Aggiorna Dati
                </Button>
            </Box>

            {/* Stats Overview */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center">
                                <Avatar sx={{ bgcolor: '#3b82f6', mr: 2, borderRadius: '12px' }}><PeopleIcon /></Avatar>
                                <Box>
                                    <Typography color="textSecondary" variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>Merchant</Typography>
                                    <Typography variant="h5" fontWeight="900">{stats?.totalMerchants || 0}</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center">
                                <Avatar sx={{ bgcolor: '#22c55e', mr: 2, borderRadius: '12px' }}><InventoryIcon /></Avatar>
                                <Box>
                                    <Typography color="textSecondary" variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>Prodotti</Typography>
                                    <Typography variant="h5" fontWeight="900">{stats?.totalProductsInSystem || 0}</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center">
                                <Avatar sx={{ bgcolor: '#f59e0b', mr: 2, borderRadius: '12px' }}><TerminalIcon /></Avatar>
                                <Box>
                                    <Typography color="textSecondary" variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>Operazioni</Typography>
                                    <Typography variant="h5" fontWeight="900">{stats?.totalLogs || 0}</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center">
                                <Avatar sx={{ bgcolor: '#a855f7', mr: 2, borderRadius: '12px' }}><AdminIcon /></Avatar>
                                <Box>
                                    <Typography color="textSecondary" variant="caption" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>Connessioni</Typography>
                                    <Typography variant="h5" fontWeight="900">{stats?.totalActiveProviders || 0}</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Colonna Sinistra: Utenti e Logs */}
                <Grid item xs={12} lg={8}>
                    {/* Gestione Utenti */}
                    <Paper sx={{ p: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', mb: 4 }}>
                        <Box p={3} display="flex" justifyContent="space-between" alignItems="center" sx={{ borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                            <Typography variant="h6" fontWeight="bold">🏪 Elenco Merchant</Typography>
                            <Button
                                startIcon={showNewUserForm ? <ExpandLessIcon /> : <PersonAddIcon />}
                                onClick={() => setShowNewUserForm(!showNewUserForm)}
                                size="small"
                                sx={{ color: '#000' }}
                            >
                                {showNewUserForm ? 'Annulla' : 'Aggiungi Merchant'}
                            </Button>
                        </Box>

                        <Collapse in={showNewUserForm}>
                            <Box p={3} sx={{ bgcolor: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                        <TextField fullWidth label="Nome" size="small" value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField fullWidth label="Cognome" size="small" value={newUser.cognome} onChange={(e) => setNewUser({ ...newUser, cognome: e.target.value })} />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField fullWidth label="Email" size="small" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField fullWidth label="Password" type="password" size="small" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Ruolo</InputLabel>
                                            <Select value={newUser.ruolo} label="Ruolo" onChange={(e) => setNewUser({ ...newUser, ruolo: e.target.value })}>
                                                <MenuItem value="merchant">Merchant</MenuItem>
                                                <MenuItem value="admin">Amministratore</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Button fullWidth variant="contained" disabled={creating} onClick={handleCreateUser} sx={{ height: '40px', bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' } }}>
                                            {creating ? 'In corso...' : 'Crea Account'}
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Collapse>

                        <TableContainer sx={{ maxHeight: 440 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Profilo</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Ruolo</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Prodotti</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Stato</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }} align="center">Elimina</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id} hover>
                                            <TableCell>
                                                <Box display="flex" alignItems="center">
                                                    <Avatar sx={{ mr: 2, width: 32, height: 32, fontSize: '0.8rem', bgcolor: user.ruolo === 'admin' ? '#7c3aed' : '#3b82f6' }}>
                                                        {user.nome?.[0]}{user.cognome?.[0]}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="bold">{user.nome} {user.cognome}</Typography>
                                                        <Typography variant="caption" color="textSecondary">{user.email}</Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={user.ruolo} size="small" variant="outlined" sx={{ height: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">{user._count?.masterFileRecords || 0}</Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Switch checked={user.attivo} onChange={() => toggleUserStatus(user.id, user.attivo)} color="success" size="small" disabled={user.id === 1} />
                                            </TableCell>
                                            <TableCell align="center">
                                                <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(user.id)} disabled={user.id === 1}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* Attività Recente */}
                    <Paper sx={{ p: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <Box p={3} display="flex" justifyContent="space-between" alignItems="center" sx={{ borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                            <Typography variant="h6" fontWeight="bold">📋 Log di Sistema Globali</Typography>
                            <Chip label="Real-time" size="small" color="info" variant="outlined" />
                        </Box>
                        <TableContainer sx={{ maxHeight: 350 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Data</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Fase</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Merchant</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Stato</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {logs.slice(0, 15).map((log) => (
                                        <TableRow key={log.id} hover>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>{new Date(log.dataEsecuzione).toLocaleString('it-IT')}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>{log.faseProcesso}</TableCell>
                                            <TableCell sx={{ fontSize: '0.75rem' }}>{log.utente?.email || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Box display="flex" alignItems="center">
                                                    {log.stato === 'success' || log.stato === 'completed' ? (
                                                        <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e', mr: 0.5 }} />
                                                    ) : (
                                                        <ErrorIcon sx={{ fontSize: 16, color: '#ef4444', mr: 0.5 }} />
                                                    )}
                                                    <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>{log.stato}</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Colonna Destra: Health e Global Settings */}
                <Grid item xs={12} lg={4}>
                    {/* System Health */}
                    <Paper sx={{ p: 3, borderRadius: '16px', mb: 4, border: '1px solid #e2e8f0', bgcolor: '#0f172a', color: '#fff' }}>
                        <Box display="flex" alignItems="center" mb={3}>
                            <ServerIcon sx={{ mr: 2, color: '#38bdf8' }} />
                            <Typography variant="h6" fontWeight="bold">System Health</Typography>
                        </Box>

                        <Box mb={3}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                                <Box display="flex" alignItems="center">
                                    <MemoryIcon sx={{ fontSize: 16, mr: 1, color: '#94a3b8' }} />
                                    <Typography variant="body2" color="#94a3b8">Utilizzo CPU</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="bold">{health?.server?.cpuLoad || '0,00'}</Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={parseFloat(health?.server?.cpuLoad || '0') * 10} sx={{ height: 6, borderRadius: 3, bgcolor: '#1e293b', '& .MuiLinearProgress-bar': { bgcolor: '#38bdf8' } }} />
                        </Box>

                        <Box mb={3}>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                                <Box display="flex" alignItems="center">
                                    <SettingsIcon sx={{ fontSize: 16, mr: 1, color: '#94a3b8' }} />
                                    <Typography variant="body2" color="#94a3b8">Ram Disponibile</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="bold">{health?.server?.memory?.free || 'N/A'}</Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={health?.server?.memory?.usedPercent || 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#1e293b', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }} />
                        </Box>

                        <Divider sx={{ my: 2, borderColor: '#1e293b' }} />

                        <Box>
                            <Typography variant="caption" color="#94a3b8" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Database Stats</Typography>
                            {health?.database?.tables?.map((t: any) => (
                                <Box key={t.table} display="flex" justifyContent="space-between" mt={1}>
                                    <Typography variant="caption" color="#cbd5e1">{t.table.replace('_', ' ')}</Typography>
                                    <Typography variant="caption" fontWeight="bold">{t.count.toLocaleString()}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    {/* Global App Settings */}
                    <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <Box display="flex" alignItems="center" mb={3}>
                            <AppIcon sx={{ mr: 2, color: '#f59e0b' }} />
                            <Typography variant="h6" fontWeight="bold">Global AI Keys</Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
                            Queste chiavi sono utilizzate per tutti gli utenti che non hanno configurato le proprie chiavi personali.
                        </Typography>

                        <Box component="form">
                            <Box mb={2}>
                                <Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>Google Gemini Key</Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="password"
                                    placeholder="Inserisci Gemini API Key"
                                    value={globalSettings.GEMINI_API_KEY}
                                    onChange={(e) => setGlobalSettings({ ...globalSettings, GEMINI_API_KEY: e.target.value })}
                                />
                            </Box>

                            <Box mb={3}>
                                <Typography variant="caption" fontWeight="bold" sx={{ mb: 0.5, display: 'block' }}>OpenAI Key</Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="password"
                                    placeholder="Inserisci OpenAI API Key"
                                    value={globalSettings.OPENAI_API_KEY}
                                    onChange={(e) => setGlobalSettings({ ...globalSettings, OPENAI_API_KEY: e.target.value })}
                                />
                            </Box>

                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleSaveGlobalSettings}
                                disabled={savingSettings}
                                sx={{ bgcolor: '#000', borderRadius: '8px', py: 1 }}
                            >
                                {savingSettings ? 'Salvataggio...' : 'Aggiorna Chiavi Globali'}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Dialog Eliminazione */}
            <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} PaperProps={{ sx: { borderRadius: '16px' } }}>
                <DialogTitle sx={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ Eliminazione Definitiva</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '0.9rem' }}>
                        Stai per eliminare il merchant e tutti i prodotti, listini e configurazioni associate.
                        Questa operazione è <strong style={{ color: '#dc2626' }}>permanente</strong>.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCloseDeleteDialog}>Annulla</Button>
                    <Button onClick={handleDeleteUser} color="error" variant="contained" sx={{ borderRadius: '8px' }}>
                        Conferma Eliminazione
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminPanel;
