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
} from '@mui/material';
import {
    TrendingUp,
    Store,
    Inventory,
    Schedule,
    CheckCircle,
    Error as ErrorIcon,
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
                background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                border: `1px solid ${color}30`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px -10px rgba(0, 0, 0, 0.15)',
                },
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            backgroundColor: `${color}20`,
                            color: color,
                            display: 'flex',
                            mr: 2,
                        }}
                    >
                        {icon}
                    </Box>
                    <Typography variant="h6" color="text.secondary" fontWeight={500}>
                        {title}
                    </Typography>
                </Box>
                <Typography variant="h3" fontWeight={700} sx={{ mb: 0.5 }}>
                    {value}
                </Typography>
                {subtitle && (
                    <Typography variant="body2" color="text.secondary">
                        {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await api.get('/dashboard/stats');
            setStats(response.data?.data || null);
        } catch (error) {
            toast.error('Errore nel caricamento delle statistiche');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };


    const recentActivity = stats?.recentActivity || [];

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Panoramica del sistema di gestione listini
                </Typography>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Fornitori Attivi"
                        value={stats?.totalFornitori || 0}
                        icon={<Store fontSize="large" />}
                        color="#424242"
                        subtitle="Configurati e attivi"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Prodotti Totali"
                        value={(stats?.totalProdotti ?? 0).toLocaleString()}
                        icon={<Inventory fontSize="large" sx={{ color: '#FFD700' }} />}
                        color="#000000"
                        subtitle="Nel master file"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Sync Shopify Oggi"
                        value={(stats?.prodottiImportatiOggi ?? 0).toLocaleString()}
                        icon={<TrendingUp fontSize="large" />}
                        color="#FBC02D"
                        subtitle="Prodotti caricati"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Ultima Attività"
                        value={stats?.ultimaEsecuzione ? new Date(stats.ultimaEsecuzione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        icon={<Schedule fontSize="large" />}
                        color="#616161"
                        subtitle={stats?.ultimaEsecuzione ? new Date(stats.ultimaEsecuzione).toLocaleDateString('it-IT') : ''}
                    />
                </Grid>
            </Grid>

            {/* Activity Log */}
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            Attività Recenti
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
                                            mb: 2,
                                            pb: 2,
                                            borderBottom: index < recentActivity.length - 1 ? '1px solid #f0f0f0' : 'none',
                                        }}
                                    >
                                        {activity.status === 'success' ? (
                                            <CheckCircle sx={{ color: '#FFD700', mr: 2 }} />
                                        ) : activity.status === 'error' ? (
                                            <ErrorIcon sx={{ color: 'error.main', mr: 2 }} />
                                        ) : (
                                            <Inventory sx={{ color: '#000000', mr: 2 }} />
                                        )}
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight={500}>
                                                {activity.text}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {activity.time}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={activity.status === 'success' ? 'OK' : activity.status === 'info' ? 'Info' : 'Errore'}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                ...(activity.status === 'success' && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff',
                                                    '& .MuiChip-label': { color: '#ffffff' }
                                                })
                                            }}
                                            color={activity.status === 'success' ? 'default' : activity.status === 'info' ? 'default' : 'error'}
                                            variant={activity.status === 'info' ? 'outlined' : 'filled'}
                                        />
                                    </Box>
                                ))
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
