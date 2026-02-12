import { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    Grid,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    IconButton,
    Tooltip,
    LinearProgress
} from '@mui/material';
import {
    Storefront as ShopifyIcon,
    Sync as SyncIcon,
    CheckCircle as CheckIcon,
    Save as SaveIcon,
    Visibility as VisibilityIcon,
    CloudDownload as CloudDownloadIcon,
    Image as ImageIcon,
    Description as DescriptionIcon,
    Memory as MemoryIcon
} from '@mui/icons-material';

import api from '../utils/api';
import { toast } from 'react-toastify';

export default function Integrazioni() {
    const [config, setConfig] = useState({
        shopUrl: '',
        accessToken: '',
        configured: false,
        placeholderImageUrl: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [savingPlaceholder, setSavingPlaceholder] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Shopify Preview State
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [previewTotal, setPreviewTotal] = useState(0);
    const [previewPage, setPreviewPage] = useState(0);
    const [previewRowsPerPage, setPreviewRowsPerPage] = useState(10);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // --- STATE: ICECAT ---
    const [icecatConfig, setIcecatConfig] = useState({
        username: '',
        password: '',
        configured: false
    });
    const [enriching, setEnriching] = useState(false);
    const [editingPassword, setEditingPassword] = useState(false);
    const [openEnrichConfirm, setOpenEnrichConfirm] = useState(false);

    // Icecat Enriched Products Dialog State
    const [openEnrichedDialog, setOpenEnrichedDialog] = useState(false);
    const [enrichedData, setEnrichedData] = useState<any[]>([]);
    const [enrichedTotal, setEnrichedTotal] = useState(0);
    const [enrichedPage, setEnrichedPage] = useState(0);
    const [enrichedRowsPerPage, setEnrichedRowsPerPage] = useState(10);
    const [loadingEnriched, setLoadingEnriched] = useState(false);

    // Icecat Progress State
    const [icecatProgress, setIcecatProgress] = useState({
        total: 0,
        enriched: 0,
        remaining: 0,
        percentage: 0,
        isRunning: false,
        estimatedMinutesRemaining: 0
    });

    // Shopify Progress State
    const [shopifyProgress, setShopifyProgress] = useState({
        total: 0,
        uploaded: 0,
        pending: 0,
        errors: 0,
        percentage: 0,
        isRunning: false,
        estimatedMinutesRemaining: 0
    });

    // AI Progress State
    const [aiProgress, setAiProgress] = useState({
        total: 0,
        processed: 0,
        pending: 0,
        percentage: 0,
        isRunning: false
    });

    const [aiEnriching, setAiEnriching] = useState(false);

    useEffect(() => {
        fetchConfig();
        fetchIcecatConfig();
        fetchShopifyPreview(); // Load preview initially
        fetchIcecatProgress(); // Load initial progress
        fetchShopifyProgress(); // Load initial Shopify progress
        fetchAIProgress(); // Load initial AI progress
    }, []);

    // Poll Icecat progress every 5 seconds if enrichment is running
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (icecatProgress.isRunning || enriching) {
            interval = setInterval(() => {
                fetchIcecatProgress();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [icecatProgress.isRunning, enriching]);

    // Poll Shopify progress every 5 seconds if sync is running
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (shopifyProgress.isRunning || syncing) {
            interval = setInterval(() => {
                fetchShopifyProgress();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [shopifyProgress.isRunning, syncing]);

    // Poll AI progress every 5 seconds if enrichment is running
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (aiEnriching) {
            interval = setInterval(() => {
                fetchAIProgress();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [aiEnriching]);

    // --- API CALLS: SHOPIFY ---

    const fetchConfig = async () => {
        try {
            const response = await api.get('/shopify/config');
            const data = response.data?.data;
            if (data) {
                setConfig({
                    shopUrl: data.shopUrl || '',
                    accessToken: '',
                    configured: data.configured || false,
                    placeholderImageUrl: data.placeholderImageUrl || ''
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('Errore caricamento configurazione Shopify');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlaceholder = async () => {
        setSavingPlaceholder(true);
        try {
            await api.post('/shopify/placeholder', {
                placeholderImageUrl: config.placeholderImageUrl
            });
            toast.success('Immagine placeholder salvata');
        } catch (error: any) {
            toast.error(error.response?.data?.error?.message || 'Errore salvataggio placeholder');
        } finally {
            setSavingPlaceholder(false);
        }
    };

    const fetchShopifyPreview = async () => {
        setLoadingPreview(true);
        try {
            const response = await api.get('/shopify/preview', {
                params: {
                    page: previewPage + 1,
                    limit: previewRowsPerPage
                }
            });
            setPreviewData(response.data?.data?.products || []);
            setPreviewTotal(response.data?.data?.pagination?.total || 0);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingPreview(false);
        }
    };

    useEffect(() => {
        fetchShopifyPreview();
    }, [previewPage, previewRowsPerPage]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/shopify/config', {
                shopUrl: config.shopUrl,
                accessToken: config.accessToken
            });
            toast.success('Configurazione Shopify salvata');
            fetchConfig();
        } catch (error: any) {
            toast.error(error.response?.data?.error?.message || 'Errore salvataggio Shopify');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        const toastId = toast.loading('Generazione export in corso...');

        try {
            const response = await api.post('/shopify/generate');
            const { prepared } = response.data.data;

            toast.update(toastId, {
                render: `Export generato! ${prepared} prodotti pronti`,
                type: 'success',
                isLoading: false,
                autoClose: 3000
            });
            fetchShopifyPreview(); // Aggiorna anteprima
        } catch (error: any) {
            toast.update(toastId, {
                render: 'Errore durante la generazione',
                type: 'error',
                isLoading: false,
                autoClose: 5000
            });
        } finally {
            setGenerating(false);
        }
    };

    const [openSyncConfirm, setOpenSyncConfirm] = useState(false);

    const handleOpenSyncConfirm = () => {
        setOpenSyncConfirm(true);
    };

    const handleCloseSyncConfirm = () => {
        setOpenSyncConfirm(false);
    };

    const executeSync = async () => {
        setSyncing(true);
        const toastId = toast.loading('Avvio sincronizzazione...');
        handleCloseSyncConfirm();

        try {
            const response = await api.post('/shopify/sync');
            const data = response.data.data;

            if (data.background) {
                toast.update(toastId, {
                    render: 'Sincronizzazione avviata in background. Monitora il progresso qui sotto.',
                    type: 'info',
                    isLoading: false,
                    autoClose: 5000
                });
                // Avviamo subito il polling del progresso
                fetchShopifyProgress();
            } else {
                const { prepared, success, errors } = data;
                toast.update(toastId, {
                    render: `Sync completato! Preparati: ${prepared || 0}, Inviati: ${success || 0}, Errori: ${errors || 0}`,
                    type: 'success',
                    isLoading: false,
                    autoClose: 5000
                });
            }
            fetchShopifyPreview(); // Refresh preview
        } catch (error: any) {
            console.error('❌ ERRORE CRITICO SYNC:', error);

            const technicalDetails = {
                timestamp: new Date().toISOString(),
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: error.config?.url,
                method: error.config?.method,
                data: error.response?.data,
                message: error.message,
                stack: error.stack?.substring(0, 300)
            };

            const errorMsg = error.response?.data?.error || error.message || 'Errore di connessione';

            toast.update(toastId, {
                render: (
                    <Box>
                        <Typography variant="body2" fontWeight="bold">Sincronizzazione fallita</Typography>
                        <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>{typeof errorMsg === 'string' ? errorMsg : 'Errore tecnico'}</Typography>
                        <Button
                            size="small"
                            variant="contained"
                            color="error"
                            style={{ fontSize: '10px', padding: '2px 8px' }}
                            onClick={() => {
                                alert(`DETTAGLI TECNICI PER ASSISTENZA:\n\n${JSON.stringify(technicalDetails, null, 2)}`);
                            }}
                        >
                            Dettagli Tecnici
                        </Button>
                    </Box>
                ),
                type: 'error',
                isLoading: false,
                autoClose: 10000
            });
        } finally {
            setSyncing(false);
        }
    };

    // --- API CALLS: ICECAT ---

    const fetchIcecatConfig = async () => {
        try {
            const response = await api.get('/icecat/config');
            const data = response.data?.data;
            if (data) {
                setIcecatConfig({
                    username: data.username || '',
                    password: '',
                    configured: data.configured || false
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchIcecatProgress = async () => {
        try {
            const response = await api.get('/icecat/progress');
            if (response.data?.success) {
                const { total, enriched, pending, percentage } = response.data.data || {};
                setIcecatProgress(prev => ({
                    ...prev,
                    total: total || 0,
                    enriched: enriched || 0,
                    remaining: pending || 0,
                    percentage: percentage || 0
                }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchShopifyProgress = async () => {
        try {
            const response = await api.get('/shopify/progress');
            if (response.data?.success) {
                const { total, uploaded, pending, errors, percentage } = response.data.data || {};
                setShopifyProgress(prev => ({
                    ...prev,
                    total: total || 0,
                    uploaded: uploaded || 0,
                    pending: pending || 0,
                    errors: errors || 0,
                    percentage: percentage || 0
                }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchAIProgress = async () => {
        try {
            const response = await api.get('/ai/stats');
            if (response.data?.success) {
                const data = response.data.data || {};
                setAiProgress(prev => ({
                    ...prev,
                    ...data,
                    isRunning: aiEnriching
                }));

                // Se abbiamo finito il batch, ferma il polling
                if (data.pending === 0 && aiEnriching) {
                    setAiEnriching(false);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchEnrichedProducts = async () => {
        setLoadingEnriched(true);
        try {
            const response = await api.get('/icecat/enriched', {
                params: {
                    page: enrichedPage + 1,
                    limit: enrichedRowsPerPage
                }
            });
            setEnrichedData(response.data?.data?.data || []);
            setEnrichedTotal(response.data?.data?.pagination?.total || 0);
        } catch (error) {
            console.error(error);
            toast.error('Errore caricamento prodotti arricchiti');
        } finally {
            setLoadingEnriched(false);
        }
    };

    useEffect(() => {
        if (openEnrichedDialog) {
            fetchEnrichedProducts();
        }
    }, [openEnrichedDialog, enrichedPage, enrichedRowsPerPage]);

    const handleSaveIcecat = async () => {
        try {
            await api.post('/icecat/config', {
                username: icecatConfig.username,
                password: icecatConfig.password
            });
            toast.success('Credenziali ICecat salvate');
            fetchIcecatConfig();
        } catch (error: any) {
            toast.error('Errore salvataggio ICecat');
        }
    };

    const handleOpenEnrichConfirm = () => {
        setOpenEnrichConfirm(true);
    };

    const handleCloseEnrichConfirm = () => {
        setOpenEnrichConfirm(false);
    };

    const executeEnrichment = async () => {
        setEnriching(true);
        const toastId = toast.loading('Arricchimento in corso...');
        handleCloseEnrichConfirm();

        try {
            const response = await api.post('/icecat/enrich');
            const { processed, enriched } = response.data.data;

            toast.update(toastId, {
                render: `Arricchimento completato! Processati: ${processed}, Arricchiti: ${enriched}`,
                type: 'success',
                isLoading: false,
                autoClose: 5000
            });
        } catch (error: any) {
            toast.update(toastId, {
                render: error.response?.data?.error?.message || 'Errore arricchimento',
                type: 'error',
                isLoading: false,
                autoClose: 5000
            });
        } finally {
            setEnriching(false);
        }
    };

    if (loading) {
        return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
    }

    return (
        <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
                Integrazioni
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Gestisci le connessioni con piattaforme esterne e monitora i flussi di dati.
            </Typography>

            <Grid container spacing={3}>

                {/* 1. ICECAT (TOP) */}
                <Grid item xs={12}>
                    <Card elevation={3}>
                        <CardHeader
                            title={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="h6" fontWeight={700}>Arricchimento Dati (ICecat)</Typography>
                                    {icecatConfig.configured &&
                                        <Chip
                                            label="Attivo"
                                            size="small"
                                            variant="filled"
                                            icon={<CheckIcon style={{ color: '#FFD700' }} />}
                                            sx={{
                                                backgroundColor: '#000000',
                                                color: '#ffffff',
                                                '& .MuiChip-label': { color: '#ffffff' },
                                                '& .MuiChip-icon': { color: '#FFD700' }
                                            }}
                                        />
                                    }
                                </Box>
                            }
                            subheader="Scarica automaticamente descrizioni, immagini e schede tecniche"
                            action={
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<CloudDownloadIcon />}
                                        onClick={() => window.open('/api/icecat/export/csv', '_blank')}
                                    >
                                        CSV
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<CloudDownloadIcon />}
                                        onClick={() => window.open('/api/icecat/export/json', '_blank')}
                                    >
                                        JSON
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<VisibilityIcon />}
                                        onClick={() => window.open('/api/icecat/export/html', '_blank')}
                                    >
                                        Tabella HTML
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<VisibilityIcon />}
                                        onClick={() => setOpenEnrichedDialog(true)}
                                    >
                                        Prodotti Arricchiti
                                    </Button>
                                </Box>
                            }
                        />
                        <Divider />
                        <CardContent>
                            <Grid container spacing={3} alignItems="center">
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="Username Open Icecat"
                                        fullWidth
                                        size="small"
                                        value={icecatConfig.username}
                                        onChange={(e) => setIcecatConfig({ ...icecatConfig, username: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    {icecatConfig.configured && !editingPassword ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TextField
                                                label="Password"
                                                fullWidth
                                                size="small"
                                                type="password"
                                                value="********"
                                                disabled
                                            />
                                            <Button variant="outlined" size="small" onClick={() => setEditingPassword(true)}>
                                                Modifica
                                            </Button>
                                        </Box>
                                    ) : (
                                        <TextField
                                            label="Password Open Icecat"
                                            fullWidth
                                            size="small"
                                            type="password"
                                            placeholder={icecatConfig.configured ? "Nuova password" : "Password"}
                                            value={icecatConfig.password || ''}
                                            onChange={(e) => setIcecatConfig({ ...icecatConfig, password: e.target.value })}
                                        />
                                    )}
                                </Grid>
                                <Grid item xs={12} md={4} sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<SaveIcon />}
                                        onClick={handleSaveIcecat}
                                    >
                                        Salva
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={enriching ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon sx={{ color: '#FFD700' }} />}
                                        onClick={handleOpenEnrichConfirm}
                                        disabled={enriching || !icecatConfig.username}
                                        fullWidth
                                    >
                                        Avvia Arricchimento
                                    </Button>
                                </Grid>
                                {/* Confirmation Dialog */}
                                <Dialog
                                    open={openEnrichConfirm}
                                    onClose={handleCloseEnrichConfirm}
                                    aria-labelledby="alert-dialog-title"
                                    aria-describedby="alert-dialog-description"
                                >
                                    <DialogTitle id="alert-dialog-title">
                                        {"Avviare arricchimento dati?"}
                                    </DialogTitle>
                                    <DialogContent>
                                        <DialogContentText id="alert-dialog-description">
                                            Il processo scaricherà schede tecniche, immagini e descrizioni da Icecat per i prodotti nel Master File.
                                            Nota: Potrebbe richiedere del tempo.
                                        </DialogContentText>
                                    </DialogContent>
                                    <DialogActions>
                                        <Button onClick={handleCloseEnrichConfirm} color="inherit">
                                            Annulla
                                        </Button>
                                        <Button onClick={executeEnrichment} variant="contained" autoFocus>
                                            Conferma e Avvia
                                        </Button>
                                    </DialogActions>
                                </Dialog>

                                {/* Progress Bar */}
                                {(icecatProgress.total > 0) && (
                                    <Grid item xs={12}>
                                        <Box sx={{ mt: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    Progresso Arricchimento
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {(icecatProgress.enriched || 0).toLocaleString()} / {(icecatProgress.total || 0).toLocaleString()} prodotti ({icecatProgress.percentage || 0}%)
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={icecatProgress.percentage}
                                                sx={{
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor: '#FFD700'
                                                    }
                                                }}
                                            />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {icecatProgress.isRunning ? (
                                                        <>
                                                            🔄 In esecuzione... Rimanenti: {(icecatProgress.remaining || 0).toLocaleString()} prodotti
                                                        </>
                                                    ) : icecatProgress.percentage === 100 ? (
                                                        '✅ Arricchimento completato'
                                                    ) : (
                                                        `⏸️ In pausa - ${(icecatProgress.remaining || 0).toLocaleString()} prodotti da arricchire`
                                                    )}
                                                </Typography>
                                                {icecatProgress.isRunning && icecatProgress.estimatedMinutesRemaining > 0 && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        ⏱️ Tempo stimato: ~{icecatProgress.estimatedMinutesRemaining} min
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    </Grid>
                                )}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                {/* 2. AI ENRICHMENT (MIDDLE) */}
                <Grid item xs={12}>
                    <Card elevation={3}>
                        <CardHeader
                            avatar={<MemoryIcon sx={{ color: '#FFD700', fontSize: 40 }} />}
                            title={<Typography variant="h6" fontWeight={700}>Arricchimento AI (Gemini)</Typography>}
                            subheader="Migliora titoli e descrizioni usando l'intelligenza artificiale"
                            action={
                                aiProgress.processed > 0 &&
                                <Chip
                                    label={`${aiProgress.processed} Prodotti Pronti`}
                                    size="small"
                                    sx={{ backgroundColor: '#000', color: '#fff' }}
                                />
                            }
                        />
                        <Divider />
                        <CardContent>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="body2" color="text.secondary" paragraph>
                                    L'AI analizzerà i dati tecnici di Icecat per generare titoli SEO professionali
                                    e descrizioni HTML eleganti caricate direttamente su Shopify.
                                </Typography>
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    Assicurati di aver completato l'arricchimento Icecat per i prodotti che desideri migliorare.
                                </Alert>
                            </Box>

                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={8}>
                                    {aiProgress.total > 0 && (
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    Progresso AI
                                                </Typography>
                                                <Typography variant="body2">
                                                    {aiProgress.processed} / {aiProgress.total} ({aiProgress.percentage}%)
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={aiProgress.percentage}
                                                sx={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.05)', '& .MuiLinearProgress-bar': { backgroundColor: '#FFD700' } }}
                                            />
                                        </Box>
                                    )}
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        startIcon={aiEnriching ? <CircularProgress size={20} color="inherit" /> : <MemoryIcon sx={{ color: '#FFD700' }} />}
                                        onClick={async () => {
                                            setAiEnriching(true);
                                            try {
                                                await api.post('/ai/enrich?limit=500'); // Processa un bel blocco
                                                toast.info('Arricchimento AI avviato in background');
                                                fetchAIProgress();
                                            } catch (e) {
                                                setAiEnriching(false);
                                                toast.error('Errore avvio AI');
                                            }
                                        }}
                                        disabled={aiEnriching || aiProgress.total === 0}
                                    >
                                        {aiEnriching ? 'AI in corso...' : 'Migliora con AI'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* 2. SHOPIFY (MIDDLE) */}
                <Grid item xs={12}>
                    <Card elevation={3}>
                        <CardHeader
                            avatar={<ShopifyIcon sx={{ color: '#FFD700', fontSize: 40 }} />}
                            title={<Typography variant="h6" fontWeight={700}>Shopify Export</Typography>}
                            subheader="Configurazione e sincronizzazione catalogo"
                            action={
                                config.configured &&
                                <Chip
                                    label="Connesso"
                                    size="small"
                                    variant="filled"
                                    icon={<CheckIcon style={{ color: '#FFD700' }} />}
                                    sx={{
                                        backgroundColor: '#000000',
                                        color: '#ffffff',
                                        '& .MuiChip-label': { color: '#ffffff' },
                                        '& .MuiChip-icon': { color: '#FFD700' }
                                    }}
                                />
                            }
                        />
                        <Divider />
                        <CardContent>
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        Inserisci l'URL del tuo negozio (es. <code>my-shop.myshopify.com</code>) e l'Admin API Access Token.
                                    </Alert>
                                </Grid>
                                <Grid item xs={12} md={5}>
                                    <TextField
                                        label="Shop URL"
                                        fullWidth
                                        placeholder="my-shop.myshopify.com"
                                        value={config.shopUrl}
                                        onChange={(e) => setConfig({ ...config, shopUrl: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={5}>
                                    <TextField
                                        label="Admin API Access Token"
                                        fullWidth
                                        type="password"
                                        placeholder={config.configured ? '••••••••••••••••' : 'shpat_...'}
                                        value={config.accessToken || ''}
                                        onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                                        helperText={config.configured ? 'Lascia vuoto per mantenere attuale' : 'Richiesto'}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                    <Button
                                        variant="contained"
                                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon sx={{ color: '#FFD700' }} />}
                                        onClick={handleSave}
                                        disabled={saving}
                                        fullWidth
                                        sx={{ height: '56px' }}
                                    >
                                        Salva
                                    </Button>
                                </Grid>

                                {/* Placeholder Image Section */}
                                <Grid item xs={12}>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                                        Immagine Placeholder
                                    </Typography>
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        URL dell'immagine da usare quando un prodotto non ha foto. Inserisci un URL pubblico di un'immagine.
                                    </Alert>
                                    <Grid container spacing={2} alignItems="center">
                                        <Grid item xs={12} md={8}>
                                            <TextField
                                                label="URL Immagine Placeholder"
                                                fullWidth
                                                size="small"
                                                placeholder="https://example.com/placeholder.png"
                                                value={config.placeholderImageUrl}
                                                onChange={(e) => setConfig({ ...config, placeholderImageUrl: e.target.value })}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={2}>
                                            <Button
                                                variant="outlined"
                                                startIcon={savingPlaceholder ? <CircularProgress size={20} /> : <SaveIcon />}
                                                onClick={handleSavePlaceholder}
                                                disabled={savingPlaceholder}
                                                fullWidth
                                            >
                                                Salva
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} md={2}>
                                            {config.placeholderImageUrl && (
                                                <Box
                                                    component="img"
                                                    src={config.placeholderImageUrl}
                                                    alt="Placeholder preview"
                                                    sx={{ maxWidth: '100%', maxHeight: 60, borderRadius: 1, border: '1px solid #ddd' }}
                                                    onError={(e: any) => e.target.style.display = 'none'}
                                                />
                                            )}
                                        </Grid>
                                    </Grid>
                                </Grid>

                                {/* Output Preview Section */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
                                        Anteprima Output Generato
                                    </Typography>
                                    <Paper variant="outlined">
                                        <TableContainer sx={{ maxHeight: 400 }}>
                                            <Table stickyHeader size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Handle</TableCell>
                                                        <TableCell>Titolo</TableCell>
                                                        <TableCell>Tags</TableCell>
                                                        <TableCell>Prezzo</TableCell>
                                                        <TableCell>Qta</TableCell>
                                                        <TableCell>Stato</TableCell>
                                                        <TableCell>Info</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {loadingPreview ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell>
                                                        </TableRow>
                                                    ) : previewData.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} align="center">Nessun dato pronto per l'export. Avvia la sincronizzazione per generare l'output.</TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        previewData.filter(r => r && r.id).map((row) => (
                                                            <TableRow key={row.id}>
                                                                <TableCell>{row.handle || 'N/D'}</TableCell>
                                                                <TableCell>{row.title || 'Senza titolo'}</TableCell>
                                                                <TableCell>
                                                                    {row.tags && typeof row.tags === 'string' ? row.tags.split(',').map((tag: string, index: number) => (
                                                                        <Chip key={index} label={tag.trim()} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                                                                    )) : '-'}
                                                                </TableCell>
                                                                <TableCell>€ {row.variantPrice || '0.00'}</TableCell>
                                                                <TableCell>{row.variantInventoryQty || 0}</TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={row.statoCaricamento || 'pending'}
                                                                        size="small"
                                                                        sx={{
                                                                            ...(row.statoCaricamento === 'uploaded' && {
                                                                                backgroundColor: '#000000',
                                                                                color: '#ffffff',
                                                                            })
                                                                        }}
                                                                        color={row.statoCaricamento === 'uploaded' ? 'default' : row.statoCaricamento === 'error' ? 'error' : 'default'}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    {row.bodyHtml && <Tooltip title="Descrizione presente"><DescriptionIcon fontSize="small" color="action" /></Tooltip>}
                                                                    {row.immaginiUrls && <Tooltip title="Immagini presenti"><ImageIcon fontSize="small" color="action" sx={{ ml: 1 }} /></Tooltip>}
                                                                    {row.specificheJson && <Tooltip title="Specifiche tecniche estratte"><MemoryIcon fontSize="small" color="action" sx={{ ml: 1 }} /></Tooltip>}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        <TablePagination
                                            component="div"
                                            count={previewTotal || 0}
                                            page={previewPage}
                                            onPageChange={(_, p) => setPreviewPage(p)}
                                            rowsPerPage={previewRowsPerPage}
                                            onRowsPerPageChange={(e) => setPreviewRowsPerPage(parseInt(e.target.value, 10))}
                                        />
                                    </Paper>

                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<CloudDownloadIcon />}
                                            onClick={() => window.open('/api/shopify/export/csv', '_blank')}
                                        >
                                            Scarica CSV
                                        </Button>
                                        <Button
                                            variant="contained"
                                            startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <SyncIcon sx={{ color: '#FFD700' }} />}
                                            onClick={handleGenerate}
                                            disabled={generating}
                                            sx={{ px: 3 }}
                                        >
                                            Genera Export Shopify
                                        </Button>
                                        <Button
                                            variant="contained"
                                            startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon sx={{ color: '#FFD700' }} />}
                                            onClick={handleOpenSyncConfirm}
                                            disabled={syncing}
                                            sx={{
                                                px: 4
                                            }}
                                        >
                                            Sincronizza con Shopify
                                        </Button>
                                    </Box>

                                    {/* Sync Confirmation Dialog */}
                                    <Dialog
                                        open={openSyncConfirm}
                                        onClose={handleCloseSyncConfirm}
                                        aria-labelledby="sync-dialog-title"
                                    >
                                        <DialogTitle id="sync-dialog-title">
                                            {"Avviare sincronizzazione Shopify?"}
                                        </DialogTitle>
                                        <DialogContent>
                                            <DialogContentText>
                                                Stai per inviare i prodotti selezionati e processati al tuo negozio Shopify.
                                                Questa operazione potrebbe richiedere del tempo a seconda del numero di prodotti.
                                            </DialogContentText>
                                        </DialogContent>
                                        <DialogActions>
                                            <Button onClick={handleCloseSyncConfirm} color="inherit">
                                                Annulla
                                            </Button>
                                            <Button onClick={executeSync} variant="contained" autoFocus>
                                                Conferma e Sincronizza
                                            </Button>
                                        </DialogActions>
                                    </Dialog>

                                    {/* Shopify Progress Bar */}
                                    {(shopifyProgress.total > 0) && (
                                        <Box sx={{ mt: 3, width: '100%' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    Progresso Sincronizzazione
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {(shopifyProgress.uploaded || 0).toLocaleString()} / {(shopifyProgress.total || 0).toLocaleString()} prodotti ({shopifyProgress.percentage || 0}%)
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={shopifyProgress.percentage}
                                                sx={{
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: 'rgba(0,0,0, 0.1)',
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor: '#FFD700'
                                                    }
                                                }}
                                            />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {shopifyProgress.isRunning ? (
                                                        <>
                                                            🔄 Sincronizzazione in corso... Rimanenti: {(shopifyProgress.pending || 0).toLocaleString()} prodotti
                                                        </>
                                                    ) : shopifyProgress.percentage === 100 ? (
                                                        '✅ Sincronizzazione completata'
                                                    ) : (
                                                        `⏸️ In attesa - ${(shopifyProgress.pending || 0).toLocaleString()} prodotti da sincronizzare`
                                                    )}
                                                    {shopifyProgress.errors > 0 && (
                                                        <> • ⚠️ {shopifyProgress.errors} errori</>
                                                    )}
                                                </Typography>
                                                {shopifyProgress.isRunning && shopifyProgress.estimatedMinutesRemaining > 0 && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        ⏱️ Tempo stimato: ~{shopifyProgress.estimatedMinutesRemaining} min
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    )}
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* DIALOG: Enriched Products */}
            <Dialog
                open={openEnrichedDialog}
                onClose={() => setOpenEnrichedDialog(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>Prodotti Arricchiti da Icecat</DialogTitle>
                <DialogContent dividers>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>EAN</TableCell>
                                    <TableCell>Prodotto</TableCell>
                                    <TableCell>Descrizione</TableCell>
                                    <TableCell>Immagini</TableCell>
                                    <TableCell>Data Arricchimento</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loadingEnriched ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center"><CircularProgress /></TableCell>
                                    </TableRow>
                                ) : enrichedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">Nessun prodotto arricchito trovato.</TableCell>
                                    </TableRow>
                                ) : (
                                    enrichedData.filter(i => i && i.id).map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.eanGtin}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>{item.masterFile?.nomeProdotto || 'N/A'}</Typography>
                                                <Typography variant="caption" color="text.secondary">{item.masterFile?.marca}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                {item.descrizioneLunga ? (
                                                    <Tooltip title={item.descrizioneLunga.substring(0, 200) + '...'}>
                                                        <Chip label="Completa" color="success" size="small" variant="outlined" />
                                                    </Tooltip>
                                                ) : item.descrizioneBrave ? (
                                                    <Chip label="Breve" color="warning" size="small" variant="outlined" />
                                                ) : (
                                                    <Chip label="Mancante" color="error" size="small" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.urlImmaginiJson ? (
                                                    (() => {
                                                        try {
                                                            const urls = JSON.parse(item.urlImmaginiJson);
                                                            return <Chip label={`${Array.isArray(urls) ? urls.length : 0} Img`} size="small" color="primary" variant="outlined" />;
                                                        } catch (e) {
                                                            return <Chip label="Err Img" size="small" color="error" variant="outlined" />;
                                                        }
                                                    })()
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/D'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={enrichedTotal || 0}
                        page={enrichedPage}
                        onPageChange={(_, p) => setEnrichedPage(p)}
                        rowsPerPage={enrichedRowsPerPage}
                        onRowsPerPageChange={(e) => setEnrichedRowsPerPage(parseInt(e.target.value, 10))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEnrichedDialog(false)}>Chiudi</Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
}
