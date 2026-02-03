import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    CircularProgress,
    Tooltip,
    Pagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Card,
    CardContent,
    LinearProgress,
    Divider
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    RunningWithErrors as RunningIcon,
    Info as InfoIcon,
    Timer as TimerIcon,
    Inventory as InventoryIcon,
    TrendingUp as TrendIcon,
    PieChart as PieChartIcon
} from '@mui/icons-material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import api from '../utils/api';
import { toast } from 'react-toastify';

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

interface Log {
    id: number;
    dataEsecuzione: string;
    faseProcesso: string;
    stato: string;
    prodottiProcessati: number;
    errori: string | null;
    durataSecondi: number | null;
}

export default function Logs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterStato, setFilterStato] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [analytics, setAnalytics] = useState<any>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit: 15,
                stato: filterStato || undefined
            };
            const response = await api.get('/logs', { params });
            setLogs(response.data.data);
            setTotalPages(response.data.pagination.pages);
        } catch (error) {
            toast.error('Errore nel caricamento dei log');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/logs/stats');
            setStats(response.data.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const response = await api.get('/logs/analytics');
            setAnalytics(response.data.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, filterStato]);

    useEffect(() => {
        fetchStats();
        fetchAnalytics();
    }, []);

    const getStatusChip = (stato: string) => {
        switch (stato.toLowerCase()) {
            case 'completed':
            case 'success':
            case 'successo':
                return <Chip label="Completato" size="small" color="success" icon={<CheckCircleIcon />} />;
            case 'error':
            case 'failed':
            case 'errore':
                return <Chip label="Errore" size="small" color="error" icon={<ErrorIcon />} />;
            case 'running':
                return <Chip label="In corso" size="small" color="primary" icon={<RunningIcon />} />;
            case 'warning':
                return <Chip label="Attenzione" size="small" color="warning" icon={<InfoIcon />} />;
            default:
                return <Chip label={stato} size="small" />;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const lastWorkflow = stats?.workflow;
    const fasi = stats?.fasi || [];

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Log & Monitoraggio Analitico
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Analizza le performance e la stabilità delle operazioni di sistema.
                    </Typography>
                </Box>
                <IconButton onClick={() => { fetchLogs(); fetchStats(); fetchAnalytics(); }} color="primary" sx={{ bgcolor: 'white', border: '1px solid #e2e8f0' }}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            {/* Analytics Dashboard */}
            {analytics && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
                            <CardContent>
                                <Typography variant="subtitle1" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                                    <TrendIcon color="primary" /> Tasso di Successo (7gg)
                                </Typography>
                                <Box sx={{ textAlign: 'center', py: 2 }}>
                                    <Typography variant="h2" fontWeight={800} color="success.main">
                                        {analytics.summary.successRate}%
                                    </Typography>
                                    <Typography color="text.secondary">
                                        {analytics.summary.totalSuccess} successi / {analytics.summary.totalError} errori
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={analytics.summary.successRate}
                                    sx={{ height: 10, borderRadius: 5, bgcolor: 'error.light', '& .MuiLinearProgress-bar': { bgcolor: 'success.main' } }}
                                />
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
                            <CardContent>
                                <Typography variant="subtitle1" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                                    <InventoryIcon color="primary" /> Operazioni Giornaliere
                                </Typography>
                                <Box sx={{ height: 180, mt: 2 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.daily}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="day" hide />
                                            <ChartTooltip />
                                            <Bar dataKey="success" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="error" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
                            <CardContent>
                                <Typography variant="subtitle1" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                                    <PieChartIcon color="primary" /> Distribuzione Fasi
                                </Typography>
                                <Box sx={{ height: 180, mt: 2 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={analytics.phases}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={60}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {analytics.phases.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <ChartTooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Ultimo Workflow Completo */}
            {lastWorkflow && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12}>
                        <Card variant="outlined" sx={{ borderRadius: 3, borderLeft: '6px solid #667eea' }}>
                            <CardContent>
                                <Typography variant="h6" fontWeight={600} gutterBottom display="flex" alignItems="center" gap={1}>
                                    <TimerIcon color="primary" /> Ultimo Workflow Completo: {formatDate(lastWorkflow.dataEsecuzione)}
                                </Typography>
                                <Grid container spacing={2} sx={{ mt: 1 }}>
                                    <Grid item xs={12} md={3}>
                                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Durata Totale</Typography>
                                            <Typography variant="h6" fontWeight={700}>{lastWorkflow.durataSecondi || 0}s</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Prodotti Processati</Typography>
                                            <Typography variant="h6" fontWeight={700}>{lastWorkflow.prodottiProcessati || 0}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ p: 1 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Progresso Fasi</Typography>
                                            <Box display="flex" gap={1}>
                                                {fasi.map((f: any, idx: number) => (
                                                    <Tooltip key={idx} title={`${f.faseProcesso}: ${f.stato}`}>
                                                        <Box sx={{
                                                            height: 12,
                                                            flex: 1,
                                                            bgcolor: f.stato === 'completed' ? 'success.main' : f.stato === 'error' ? 'error.main' : 'primary.main',
                                                            borderRadius: 1
                                                        }} />
                                                    </Tooltip>
                                                ))}
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Lista Log Storica */}
            <Paper sx={{ p: 0, borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fcfcfc', borderBottom: '1px solid #f1f5f9' }}>
                    <Typography variant="h6" fontWeight={600}>Storico Operazioni</Typography>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Stato</InputLabel>
                        <Select
                            value={filterStato}
                            label="Stato"
                            onChange={(e) => { setFilterStato(e.target.value); setPage(1); }}
                        >
                            <MenuItem value="">Tutti</MenuItem>
                            <MenuItem value="completed">Completati</MenuItem>
                            <MenuItem value="error">Errori</MenuItem>
                            <MenuItem value="running">In Corso</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {loading ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 2 }} color="text.secondary">Caricamento log...</Typography>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table sx={{ minWidth: 650 }}>
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell>Data ed Ora</TableCell>
                                    <TableCell>Operazione / Fase</TableCell>
                                    <TableCell>Stato</TableCell>
                                    <TableCell align="center">Oggetti</TableCell>
                                    <TableCell align="center">Durata</TableCell>
                                    <TableCell>Dettaglio/Errore</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id} hover>
                                        <TableCell sx={{ fontWeight: 500 }}>
                                            {formatDate(log.dataEsecuzione)}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>{log.faseProcesso}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusChip(log.stato)}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                                                <InventoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                <Typography variant="body2">{log.prodottiProcessati || 0}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            {log.durataSecondi ? `${log.durataSecondi}s` : '-'}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 300 }}>
                                            <Typography variant="caption" color={log.stato === 'error' ? 'error.main' : 'text.secondary'} sx={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {log.errori || 'Nessun dettaglio'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {logs.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                            <Typography color="text.secondary">Nessun log trovato con questi filtri</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, v) => setPage(v)}
                        color="primary"
                        shape="rounded"
                    />
                </Box>
            </Paper>
        </Box>
    );
}
