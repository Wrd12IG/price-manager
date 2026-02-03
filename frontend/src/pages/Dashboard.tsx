import { useEffect, useState } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Paper,
    Chip,
    LinearProgress,
    Avatar,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    TrendingUp,
    Store,
    Inventory,
    Schedule,
    CheckCircle,
    Error as ErrorIcon,
    Refresh as RefreshIcon,
    AutoAwesome as AIIcon,
    Sync as SyncIcon,
    CloudUpload as UploadIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface ActivityLog {
    text: string;
    status: 'success' | 'error' | 'info';
    time: string;
}

interface DashboardStats {
    totalFornitori: number;
    totalProdotti: number;
    ultimaEsecuzione: string | null;
    prodottiImportatiOggi: number;
    chartData?: { name: string; prodotti: number }[];
    recentActivity?: ActivityLog[];
}

interface JobProgress {
    id: string;
    type: string;
    status: 'running' | 'completed' | 'failed' | 'pending';
    progress: number;
    processed: number;
    total: number;
    startTime: string;
    metadata?: any;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
    return (
        <Card
            sx={{
                height: '100%',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                overflow: 'hidden',
                position: 'relative',
                '&:after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '80px',
                    height: '80px',
                    background: `linear-gradient(135deg, ${color}10 0%, transparent 100%)`,
                    borderRadius: '0 0 0 100%'
                }
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                        sx={{
                            p: 1.2,
                            borderRadius: '12px',
                            backgroundColor: `${color}15`,
                            color: color,
                            display: 'flex',
                            mr: 2,
                        }}
                    >
                        {icon}
                    </Box>
                    <Typography variant="overline" fontWeight="bold" color="text.secondary">
                        {title}
                    </Typography>
                </Box>
                <Typography variant="h3" fontWeight="900" sx={{ mb: 0.5, letterSpacing: '-1px' }}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </Typography>
                {subtitle && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Schedule sx={{ fontSize: 12, mr: 0.5 }} /> {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [activeJobs, setActiveJobs] = useState<JobProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const [statsRes, jobsRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/jobs/active')
            ]);
            setStats(statsRes.data?.data || null);
            setActiveJobs(jobsRes.data?.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Polling per i job attivi ogni 5 secondi se ce ne sono
        const interval = setInterval(() => {
            fetchData();
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const recentActivity = stats?.recentActivity || [];

    if (loading && !stats) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={40} thickness={4} sx={{ color: '#000' }} />
            </Box>
        );
    }

    return (
        <Box p={3} sx={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                    <Typography variant="h4" fontWeight="900" gutterBottom sx={{ letterSpacing: '-1px' }}>
                        Dashboard <Chip label="Premium" size="small" sx={{ ml: 1, bgcolor: '#000', color: '#fff', fontSize: '10px' }} />
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Monitoraggio in tempo reale dei flussi dati e sincronizzazione e-commerce
                    </Typography>
                </Box>
                <Tooltip title="Aggiorna ora">
                    <IconButton onClick={fetchData} disabled={refreshing} sx={{ bgcolor: '#f1f5f9' }}>
                        <RefreshIcon className={refreshing ? 'spin-animation' : ''} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Fornitori Collegati"
                        value={stats?.totalFornitori || 0}
                        icon={<Store />}
                        color="#3b82f6"
                        subtitle="Sorgenti dati attive"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Master File"
                        value={stats?.totalProdotti || 0}
                        icon={<Inventory />}
                        color="#000000"
                        subtitle="Prodotti consolidati"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Export Shopify"
                        value={stats?.prodottiImportatiOggi || 0}
                        icon={<UploadIcon />}
                        color="#22c55e"
                        subtitle="Sincronizzati oggi"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Ultimo Update"
                        value={stats?.ultimaEsecuzione ? new Date(stats.ultimaEsecuzione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        icon={<Schedule />}
                        color="#f59e0b"
                        subtitle={stats?.ultimaEsecuzione ? new Date(stats.ultimaEsecuzione).toLocaleDateString('it-IT') : 'Nessun workflow'}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Active Jobs / Background Tasks */}
                <Grid item xs={12} lg={4}>
                    <Paper sx={{ p: 3, borderRadius: '20px', height: '100%', border: '1px solid #e2e8f0' }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom display="flex" alignItems="center">
                            🚀 Task in Background
                            {activeJobs.length > 0 && (
                                <Box sx={{ width: 8, height: 8, bgcolor: '#22c55e', borderRadius: '50%', ml: 1.5, animation: 'pulse 2s infinite' }} />
                            )}
                        </Typography>

                        <Box sx={{ mt: 3 }}>
                            {activeJobs.length === 0 ? (
                                <Box sx={{ py: 6, textAlign: 'center' }}>
                                    <Avatar sx={{ bgcolor: '#f1f5f9', color: '#94a3b8', margin: '0 auto mb-2', width: 56, height: 56 }}>
                                        <CheckCircle />
                                    </Avatar>
                                    <Typography variant="body2" color="text.secondary">Nessuna operazione attiva</Typography>
                                    <Typography variant="caption" color="text.disabled">Il sistema è in attesa del prossimo ciclo</Typography>
                                </Box>
                            ) : (
                                activeJobs.map((job) => (
                                    <Box key={job.id} sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Box display="flex" alignItems="center">
                                                {job.type.includes('AI') ? <AIIcon sx={{ fontSize: 18, mr: 1, color: '#a855f7' }} /> : <SyncIcon sx={{ fontSize: 18, mr: 1, color: '#3b82f6' }} />}
                                                <Typography variant="subtitle2" fontWeight="bold">
                                                    {job.type.replace('_', ' ')}
                                                </Typography>
                                            </Box>
                                            <Typography variant="caption" fontWeight="bold">
                                                {Math.round(job.progress)}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={job.progress}
                                            sx={{ height: 6, borderRadius: 3, mb: 1.5, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { borderRadius: 3 } }}
                                        />
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Processati: <strong>{job.processed}</strong> / {job.total}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontStyle: 'italic' }} color="primary">
                                                in corso...
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Activity Log */}
                <Grid item xs={12} lg={8}>
                    <Paper sx={{ p: 3, borderRadius: '20px', height: '100%', border: '1px solid #e2e8f0' }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            📋 Attività Recenti
                        </Typography>
                        <Box sx={{ mt: 3 }}>
                            {recentActivity.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Nessuna attività recente</Typography>
                            ) : (
                                recentActivity.map((activity, index) => (
                                    <Box
                                        key={index}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            mb: 1.5,
                                            p: 2,
                                            borderRadius: '12px',
                                            transition: 'background-color 0.2s',
                                            '&:hover': { bgcolor: '#f8fafc' }
                                        }}
                                    >
                                        <Box sx={{
                                            p: 1,
                                            borderRadius: '10px',
                                            mr: 2,
                                            bgcolor: activity.status === 'success' ? '#dcfce7' : activity.status === 'error' ? '#fee2e2' : '#f1f5f9',
                                            color: activity.status === 'success' ? '#16a34a' : activity.status === 'error' ? '#dc2626' : '#64748b'
                                        }}>
                                            {activity.status === 'success' ? <CheckCircle fontSize="small" /> : <ErrorIcon fontSize="small" />}
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight="700">
                                                {activity.text}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {activity.time}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={activity.status.toUpperCase()}
                                            size="small"
                                            sx={{
                                                fontSize: '9px',
                                                fontWeight: 'bold',
                                                borderRadius: '6px',
                                                bgcolor: activity.status === 'success' ? '#000' : 'default',
                                                color: activity.status === 'success' ? '#fff' : 'default'
                                            }}
                                            color={activity.status === 'error' ? 'error' : 'default'}
                                        />
                                    </Box>
                                ))
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 1s linear infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
            `}</style>
        </Box>
    );
}
