import { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Grid,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    IconButton,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import {
    Schedule as ScheduleIcon,
    PlayArrow as PlayIcon,
    Refresh as RefreshIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Delete as DeleteIcon,
    Add as AddIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface LogElaborazione {
    id: number;
    dataEsecuzione: string;
    faseProcesso: string;
    stato: string;
    durataSecondi: number | null;
    dettagliJson: any;
}

export default function Scheduler() {
    const [status, setStatus] = useState({ isRunning: false, nextExecution: '' });
    const [logs, setLogs] = useState<LogElaborazione[]>([]);
    const [schedules, setSchedules] = useState<string[]>([]);

    // Form States
    const [frequency, setFrequency] = useState('daily'); // daily, weekly, monthly
    const [hour, setHour] = useState('03');
    const [minute, setMinute] = useState('00');
    const [weekDay, setWeekDay] = useState('1'); // 1 = Monday
    const [monthDay, setMonthDay] = useState('1');

    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    // Confirmation Dialog States
    const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
    const [runConfirmOpen, setRunConfirmOpen] = useState(false);

    useEffect(() => {
        fetchStatus();
        // Poll status every 5 seconds if running
        const interval = setInterval(() => {
            if (status.isRunning) fetchStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, [status.isRunning]);

    const fetchStatus = async () => {
        try {
            const response = await api.get('/api/scheduler/status');
            setStatus(response.data?.data?.status || "unknown");
            setLogs(response.data?.data?.logs || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchedules = async () => {
        try {
            const res = await api.get('/api/scheduler/schedules');
            setSchedules(Array.isArray(res.data.data) ? res.data.data : []);
        } catch (error) {
            console.error(error);
            setSchedules([]);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const generateCron = () => {
        // Cron format: Minute Hour DayMonth Month DayWeek
        const min = parseInt(minute);
        const h = parseInt(hour);

        if (frequency === 'daily') return `${min} ${h} * * *`;
        if (frequency === 'weekly') return `${min} ${h} * * ${weekDay}`; // 0-7, 1=Mon
        if (frequency === 'monthly') return `${min} ${h} ${monthDay} * *`;

        return `${min} ${h} * * *`;
    };

    const handleAddSchedule = async () => {
        const cronExpression = generateCron();

        if (schedules.includes(cronExpression)) {
            toast.warning('Questa schedulazione esiste già.');
            return;
        }

        try {
            await api.post('/api/scheduler/schedules', { expression: cronExpression });
            toast.success('Schedulazione aggiunta');
            fetchSchedules();
        } catch (error: any) {
            const msg = error.response?.data?.message || error.response?.data?.error || 'Errore aggiunta schedulazione';
            toast.error(msg);
        }
    };

    const handleOpenDeleteSchedule = (expression: string) => {
        setScheduleToDelete(expression);
    };

    const executeRemoveSchedule = async () => {
        if (!scheduleToDelete) return;

        try {
            await api.delete('/api/scheduler/schedules', { data: { expression: scheduleToDelete } });
            toast.success('Schedulazione rimossa');
            fetchSchedules();
        } catch (error: any) {
            toast.error('Errore rimozione schedulazione');
        } finally {
            setScheduleToDelete(null);
        }
    };

    const handleOpenRunConfirm = () => {
        setRunConfirmOpen(true);
    };

    const executeRun = async () => {
        setRunConfirmOpen(false);
        setStarting(true);
        try {
            await api.post('/api/scheduler/run');
            toast.success('Workflow avviato in background');
            fetchStatus();
        } catch (error: any) {
            toast.error('Errore avvio workflow');
        } finally {
            setStarting(false);
        }
    };

    const getStatusChip = (stato: string) => {
        switch (stato) {
            case 'success':
                return (
                    <Chip
                        icon={<SuccessIcon style={{ color: '#FFD700' }} />}
                        label="Completato"
                        sx={{
                            backgroundColor: '#000000',
                            color: '#ffffff',
                            '& .MuiChip-label': { color: '#ffffff' }
                        }}
                        size="small"
                    />
                );
            case 'error': return <Chip icon={<ErrorIcon />} label="Errore" color="error" size="small" />;
            case 'running': return <Chip icon={<CircularProgress size={16} sx={{ color: '#FFD700' }} />} label="In corso" sx={{ borderColor: '#FFD700', color: '#000' }} variant="outlined" size="small" />;
            default: return <Chip label={stato} size="small" />;
        }
    };

    const formatPhase = (phase: string) => {
        return phase.replace(/_/g, ' ').toUpperCase();
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Scheduler Automatico
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Gestione e monitoraggio dei processi automatici notturni.
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={fetchStatus}
                >
                    Aggiorna
                </Button>
            </Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={6}>
                    <Card elevation={3} sx={{ height: '100%' }}>
                        <CardHeader
                            avatar={<ScheduleIcon sx={{ color: '#FFD700', fontSize: 40 }} />}
                            title={<Typography variant="h6">Stato Sistema</Typography>}
                        />
                        <Divider />
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                <Typography variant="subtitle1">Stato Attuale:</Typography>
                                {status.isRunning ? (
                                    <Chip label="IN ESECUZIONE" color="warning" icon={<CircularProgress size={16} />} />
                                ) : (
                                    <Chip
                                        label="IN ATTESA"
                                        variant="outlined"
                                        sx={{
                                            borderColor: '#000000',
                                            color: '#000000',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                Prossima esecuzione programmata: <strong>{status.nextExecution}</strong>
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card elevation={3} sx={{ height: '100%' }}>
                        <CardHeader
                            avatar={<PlayIcon sx={{ color: '#FFD700', fontSize: 40 }} />}
                            title={<Typography variant="h6">Azioni Manuali</Typography>}
                        />
                        <Divider />
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Puoi forzare l'esecuzione immediata del workflow completo (Ingestione &rarr; Consolidamento &rarr; Pricing &rarr; Export).
                            </Typography>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={starting ? <CircularProgress size={20} color="inherit" /> : <PlayIcon sx={{ color: '#FFD700' }} />}
                                onClick={handleOpenRunConfirm}
                                disabled={starting || status.isRunning}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                Esegui Workflow Completo
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                {/* GESTIONE ORARI */}
                <Grid item xs={12} md={12}>
                    <Card elevation={3}>
                        <CardHeader
                            title={<Typography variant="h6">Configurazione Orari (CRON)</Typography>}
                            subheader="Gestisci gli orari di esecuzione automatica del workflow."
                        />
                        <Divider />
                        <CardContent>
                            <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                                {/* Frequenza */}
                                <Grid item xs={12} sm={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Frequenza</InputLabel>
                                        <Select
                                            value={frequency}
                                            label="Frequenza"
                                            onChange={(e) => setFrequency(e.target.value)}
                                        >
                                            <MenuItem value="daily">Ogni Giorno</MenuItem>
                                            <MenuItem value="weekly">Ogni Settimana</MenuItem>
                                            <MenuItem value="monthly">Ogni Mese</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Orario */}
                                <Grid item xs={6} sm={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Ora</InputLabel>
                                        <Select
                                            value={hour}
                                            label="Ora"
                                            onChange={(e) => setHour(e.target.value)}
                                        >
                                            {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                                <MenuItem key={h} value={h.toString().padStart(2, '0')}>
                                                    {h.toString().padStart(2, '0')}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={6} sm={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Minuti</InputLabel>
                                        <Select
                                            value={minute}
                                            label="Minuti"
                                            onChange={(e) => setMinute(e.target.value)}
                                        >
                                            {['00', '15', '30', '45'].map(m => (
                                                <MenuItem key={m} value={m}>{m}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Opzioni Frequency-Specific */}
                                {frequency === 'weekly' && (
                                    <Grid item xs={12} sm={3}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Giorno</InputLabel>
                                            <Select
                                                value={weekDay}
                                                label="Giorno"
                                                onChange={(e) => setWeekDay(e.target.value)}
                                            >
                                                <MenuItem value="1">Lunedì</MenuItem>
                                                <MenuItem value="2">Martedì</MenuItem>
                                                <MenuItem value="3">Mercoledì</MenuItem>
                                                <MenuItem value="4">Giovedì</MenuItem>
                                                <MenuItem value="5">Venerdì</MenuItem>
                                                <MenuItem value="6">Sabato</MenuItem>
                                                <MenuItem value="0">Domenica</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}

                                {frequency === 'monthly' && (
                                    <Grid item xs={12} sm={3}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Giorno del mese</InputLabel>
                                            <Select
                                                value={monthDay}
                                                label="Giorno del mese"
                                                onChange={(e) => setMonthDay(e.target.value)}
                                            >
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                    <MenuItem key={d} value={d.toString()}>{d}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}

                                <Grid item xs={12} sm={2}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={handleAddSchedule}
                                    >
                                        Aggiungi
                                    </Button>
                                </Grid>

                                <Grid item xs={12}>
                                    <Typography variant="caption" color="text.secondary">
                                        Anteprima CRON: <code>{generateCron()}</code>
                                    </Typography>
                                </Grid>
                            </Grid>

                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                            <TableCell>Espressione CRON</TableCell>
                                            <TableCell>Descrizione</TableCell>
                                            <TableCell align="right">Azioni</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(schedules?.length || 0) === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">Nessuna schedulazione attiva.</TableCell>
                                            </TableRow>
                                        ) : (
                                            schedules?.map((schedule, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                        {schedule}
                                                    </TableCell>
                                                    <TableCell>
                                                        {schedule === '0 3 * * *' ? 'Ogni giorno alle 03:00' : 'Personalizzato'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <IconButton onClick={() => handleOpenDeleteSchedule(schedule)} color="error" size="small">
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Logs Table Section */}
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mt: 4 }}>
                Log Esecuzioni Recenti
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Data Esecuzione</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Fase / Tipo</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Stato</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Durata</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Dettagli</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell>
                            </TableRow>
                        ) : (logs?.length || 0) === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>Nessun log presente.</TableCell>
                            </TableRow>
                        ) : (
                            logs?.map((log) => (
                                <TableRow key={log.id} hover>
                                    <TableCell>{new Date(log.dataEsecuzione).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={500}>
                                            {formatPhase(log.faseProcesso)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{getStatusChip(log.stato)}</TableCell>
                                    <TableCell>{log.durataSecondi ? `${log.durataSecondi}s` : '-'}</TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                            {JSON.stringify(log.dettagliJson || {})}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Dialogs */}
            <Dialog
                open={!!scheduleToDelete}
                onClose={() => setScheduleToDelete(null)}
                aria-labelledby="delete-schedule-title"
            >
                <DialogTitle id="delete-schedule-title">Rimuovere schedulazione?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Stai per rimuovere la schedulazione: <strong>{scheduleToDelete}</strong>.
                        L'operazione è irreversibile.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setScheduleToDelete(null)} color="inherit">Annulla</Button>
                    <Button onClick={executeRemoveSchedule} color="error" variant="contained" autoFocus>
                        Rimuovi
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={runConfirmOpen}
                onClose={() => setRunConfirmOpen(false)}
                aria-labelledby="run-dialog-title"
            >
                <DialogTitle id="run-dialog-title">Avviare Workflow Manuale?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Stai per avviare manualmente l'intero processo di aggiornamento prezzi.
                        Questo include: Ingestione, Consolidamento, Calcolo Prezzi e Export.
                        Il processo verrà eseguito in background.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRunConfirmOpen(false)} color="inherit">Annulla</Button>
                    <Button onClick={executeRun} color="primary" variant="contained" autoFocus>
                        Avvia Workflow
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
}
