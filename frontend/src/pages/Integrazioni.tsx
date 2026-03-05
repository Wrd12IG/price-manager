import { useEffect, useState, useRef } from 'react';
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
    LinearProgress,
    Select,
    MenuItem,
    InputAdornment,
    ToggleButtonGroup,
    ToggleButton,
    Drawer,
    Tabs,
    Tab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Badge
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
    Memory as MemoryIcon,
    Stop as StopIcon,
    DeleteForever as DeleteForeverIcon,
    Replay as ReplayIcon,
    Search as SearchIcon,
    ArrowUpward as ArrowUpwardIcon,
    ArrowDownward as ArrowDownwardIcon,
    Block as BlockIcon,
    History as HistoryIcon,
    ExpandMore as ExpandMoreIcon,
    Close as CloseIcon,
    OpenInNew as OpenInNewIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    AutoAwesome as AutoAwesomeIcon
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
    const [cancelling, setCancelling] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [openResetConfirm, setOpenResetConfirm] = useState(false);
    const [savingPlaceholder, setSavingPlaceholder] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Live Log Sync State
    const [syncLogs, setSyncLogs] = useState<{ ts: number; level: string; msg: string }[]>([]);
    const syncLogsSince = useRef<number>(0);
    const syncLogsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const syncLogsEndRef = useRef<HTMLDivElement>(null);

    // Stato UI Actions
    const [retrying, setRetrying] = useState<Set<number>>(new Set());
    // Blacklist State
    const [blacklisting, setBlacklisting] = useState<Set<number>>(new Set());
    const [aiReviewing, setAiReviewing] = useState<Set<number>>(new Set());
    // Product Preview Modal (Feature #5)
    const [previewProduct, setPreviewProduct] = useState<any>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewTab, setPreviewTab] = useState(0);
    // Price History (Feature #7)
    const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
    const [priceHistory, setPriceHistory] = useState<any[]>([]);
    const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
    const [priceHistoryProduct, setPriceHistoryProduct] = useState<string>('');
    // Category Mapping (Feature #8)
    const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
    const [categoryMappingNewKey, setCategoryMappingNewKey] = useState('');
    const [categoryMappingNewVal, setCategoryMappingNewVal] = useState('');
    const [categoryMappingLoading, setCategoryMappingLoading] = useState(false);

    // Filter/Search State per la tabella preview
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStato, setFilterStato] = useState('all');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        fetchCategoryMapping(); // Load category mapping
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
                    limit: previewRowsPerPage,
                    search: searchQuery,
                    stato: filterStato,
                    sortBy,
                    sortOrder
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
    }, [previewPage, previewRowsPerPage, filterStato, sortBy, sortOrder]);

    // Debounce ricerca
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setPreviewPage(0);
            fetchShopifyPreview();
        }, 500);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [searchQuery]);

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

    // --- CANCEL SYNC ---
    const handleCancelSync = async () => {
        setCancelling(true);
        try {
            await api.post('/shopify/cancel');
            toast.warning('🛑 Segnale di stop inviato. La sync si fermerà al prossimo batch.');
            setSyncing(false);
        } catch (e: any) {
            toast.error('Errore invio segnale di stop');
        } finally {
            setCancelling(false);
        }
    };

    // --- RETRY SINGOLO PRODOTTO ---
    const handleRetry = async (outputId: number) => {
        setRetrying(prev => new Set(prev).add(outputId));
        try {
            await api.post(`/shopify/retry/${outputId}`);
            toast.info('🔁 Retry avviato. Il prodotto sarà aggiornato a breve.');
            // Aggiorna la tabella e le statistiche dopo qualche secondo
            setTimeout(() => {
                fetchShopifyPreview();
                fetchShopifyProgress();
            }, 3000);
        } catch (e: any) {
            toast.error(`Errore retry: ${e.response?.data?.error || e.message}`);
        } finally {
            setRetrying(prev => { const s = new Set(prev); s.delete(outputId); return s; });
        }
    };

    // --- PRODUCT PREVIEW (#5) ---
    const handlePreview = async (outputId: number) => {
        setPreviewOpen(true);
        setPreviewLoading(true);
        setPreviewTab(0);
        try {
            const res = await api.get(`/shopify/preview/${outputId}`);
            setPreviewProduct(res.data?.data || null);
        } catch {
            toast.error('Errore caricamento anteprima');
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    // --- BLACKLIST (#6) ---
    const handleBlacklist = async (outputId: number) => {
        setBlacklisting(prev => new Set(prev).add(outputId));
        try {
            const res = await api.post(`/shopify/blacklist/${outputId}`);
            const stato = res.data?.data?.statoCaricamento;
            toast.info(stato === 'blacklisted' ? '🚫 Prodotto escluso dalla sync' : '✅ Prodotto riattivato');
            setPreviewData(prev => prev.map(r => r.id === outputId ? { ...r, statoCaricamento: stato } : r));
        } catch (e: any) {
            toast.error(`Errore: ${e.response?.data?.error || e.message}`);
        } finally {
            setBlacklisting(prev => { const s = new Set(prev); s.delete(outputId); return s; });
        }
    };

    // ─── #15 AI METAFIELD REVIEW (Single) ─────────────────────────
    const handleAiReview = async (outputId: number) => {
        setAiReviewing(prev => new Set(prev).add(outputId));
        const toastId = toast.loading('Review AI in corso... attendere');
        try {
            const res = await api.post(`/shopify/ai-review/${outputId}`);
            const data = res.data.data;
            if (data.approved) {
                toast.update(toastId, { render: `Score ${data.score}/10 — Approvato ✅`, type: 'success', isLoading: false, autoClose: 4000 });
            } else {
                toast.update(toastId, { render: `Score ${data.score}/10 — Criticità rilevate ⚠️`, type: 'warning', isLoading: false, autoClose: 5000 });
            }
            fetchShopifyPreview(); // ricarica riga
        } catch (error: any) {
            toast.update(toastId, {
                render: error.response?.data?.error?.message || 'Errore AI Review',
                type: 'error',
                isLoading: false,
                autoClose: 3000
            });
        } finally {
            setAiReviewing(prev => { const s = new Set(prev); s.delete(outputId); return s; });
        }
    };

    // --- PRICE HISTORY (#7) ---
    const handlePriceHistory = async (masterFileId: number, productTitle: string) => {
        setPriceHistoryProduct(productTitle);
        setPriceHistoryOpen(true);
        setPriceHistoryLoading(true);
        try {
            const res = await api.get(`/shopify/price-history/${masterFileId}`);
            setPriceHistory(res.data?.data || []);
        } catch {
            toast.error('Errore caricamento storico prezzi');
        } finally {
            setPriceHistoryLoading(false);
        }
    };

    // --- CATEGORY MAPPING (#8) ---
    const fetchCategoryMapping = async () => {
        try {
            const res = await api.get('/shopify/category-mapping');
            setCategoryMapping(res.data?.data || {});
        } catch { /* ignore */ }
    };
    const handleSaveCategoryMapping = async (newMap: Record<string, string>) => {
        setCategoryMappingLoading(true);
        try {
            await api.post('/shopify/category-mapping', { mapping: newMap });
            setCategoryMapping(newMap);
            toast.success('Mappatura categorie salvata');
        } catch {
            toast.error('Errore salvataggio mappatura');
        } finally {
            setCategoryMappingLoading(false);
        }
    };
    const addCategoryMappingRow = () => {
        if (!categoryMappingNewKey.trim() || !categoryMappingNewVal.trim()) return;
        const updated = { ...categoryMapping, [categoryMappingNewKey.trim()]: categoryMappingNewVal.trim() };
        handleSaveCategoryMapping(updated);
        setCategoryMappingNewKey('');
        setCategoryMappingNewVal('');
    };
    const removeCategoryMappingRow = (key: string) => {
        const updated = { ...categoryMapping };
        delete updated[key];
        handleSaveCategoryMapping(updated);
    };

    // --- RESET DB ---
    const handleConfirmReset = async () => {
        setOpenResetConfirm(false);
        setResetting(true);
        const toastId = toast.loading('Reset in corso...');
        try {
            const response = await api.post('/shopify/reset');
            toast.update(toastId, {
                render: response.data.message || 'Reset completato!',
                type: 'success',
                isLoading: false,
                autoClose: 6000
            });
            fetchShopifyPreview();
            fetchShopifyProgress();
        } catch (e: any) {
            toast.update(toastId, {
                render: 'Errore durante il reset',
                type: 'error',
                isLoading: false,
                autoClose: 5000
            });
        } finally {
            setResetting(false);
        }
    };

    const executeSync = async () => {
        setSyncing(true);
        // Reset e avvio polling log
        setSyncLogs([]);
        syncLogsSince.current = 0;
        if (syncLogsInterval.current) clearInterval(syncLogsInterval.current);
        syncLogsInterval.current = setInterval(async () => {
            try {
                const res = await api.get(`/shopify/logs?since=${syncLogsSince.current}`);
                const entries: { ts: number; level: string; msg: string }[] = res.data.data || [];
                if (entries.length > 0) {
                    syncLogsSince.current = entries[entries.length - 1].ts;
                    setSyncLogs(prev => [...prev, ...entries].slice(-200));
                    // Auto-scroll al fondo
                    setTimeout(() => syncLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
            } catch (_) { /* ignora errori di polling */ }
        }, 2000);

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
            // Stop polling log dopo 5s (per catturare il messaggio finale)
            setTimeout(() => {
                if (syncLogsInterval.current) {
                    clearInterval(syncLogsInterval.current);
                    syncLogsInterval.current = null;
                }
            }, 5000);
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

                                {/* 🗂️ FEATURE #8: CATEGORY MAPPING */}
                                <Grid item xs={12}>
                                    <Accordion variant="outlined" sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography fontWeight={600}>🗂️ Mappatura Categorie → Shopify product_type</Typography>
                                                {Object.keys(categoryMapping).length > 0 && (
                                                    <Chip label={`${Object.keys(categoryMapping).length} regole`} size="small" color="primary" />
                                                )}
                                            </Box>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Mappa i nomi categoria interni al <code>product_type</code> inviato a Shopify.
                                                Lascia vuoto per usare il nome categoria com'è.
                                            </Typography>
                                            {/* Existing mappings */}
                                            {Object.keys(categoryMapping).length > 0 && (
                                                <Table size="small" sx={{ mb: 2 }}>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 700 }}>Categoria interna</TableCell>
                                                            <TableCell sx={{ fontWeight: 700 }}>product_type Shopify</TableCell>
                                                            <TableCell />
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {Object.entries(categoryMapping).map(([k, v]) => (
                                                            <TableRow key={k}>
                                                                <TableCell sx={{ fontFamily: 'monospace' }}>{k}</TableCell>
                                                                <TableCell>{v}</TableCell>
                                                                <TableCell>
                                                                    <IconButton size="small" color="error" onClick={() => removeCategoryMappingRow(k)}>
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                            {/* Add new mapping */}
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <TextField
                                                    size="small"
                                                    placeholder="Categoria interna (es. Notebook)"
                                                    value={categoryMappingNewKey}
                                                    onChange={e => setCategoryMappingNewKey(e.target.value)}
                                                    sx={{ minWidth: 200 }}
                                                />
                                                <Typography>→</Typography>
                                                <TextField
                                                    size="small"
                                                    placeholder="product_type Shopify (es. Laptop & Computer)"
                                                    value={categoryMappingNewVal}
                                                    onChange={e => setCategoryMappingNewVal(e.target.value)}
                                                    sx={{ minWidth: 260 }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={categoryMappingLoading ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                                                    onClick={addCategoryMappingRow}
                                                    disabled={!categoryMappingNewKey.trim() || !categoryMappingNewVal.trim() || categoryMappingLoading}
                                                >
                                                    Aggiungi
                                                </Button>
                                            </Box>
                                        </AccordionDetails>
                                    </Accordion>
                                </Grid>

                                {/* Output Preview Section */}
                                <Grid item xs={12}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            Anteprima Output Generato
                                            {previewTotal > 0 && (
                                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                                    ({previewTotal.toLocaleString()} prodotti)
                                                </Typography>
                                            )}
                                        </Typography>
                                    </Box>

                                    {/* 🔍 Filtri e Ricerca */}
                                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {/* Search */}
                                        <TextField
                                            size="small"
                                            placeholder="Cerca titolo, handle, SKU..."
                                            value={searchQuery}
                                            onChange={e => { setSearchQuery(e.target.value); setPreviewPage(0); }}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                                                endAdornment: searchQuery ? (
                                                    <InputAdornment position="end">
                                                        <IconButton size="small" onClick={() => { setSearchQuery(''); setPreviewPage(0); }}>
                                                            ✕
                                                        </IconButton>
                                                    </InputAdornment>
                                                ) : null
                                            }}
                                            sx={{ minWidth: 240 }}
                                        />

                                        {/* Stato chips */}
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {[
                                                { key: 'all', label: 'Tutti', color: 'default' },
                                                { key: 'pending', label: 'Pending', color: 'warning' },
                                                { key: 'uploaded', label: 'Caricati', color: 'success' },
                                                { key: 'error', label: 'Errori', color: 'error' },
                                                { key: 'price_update', label: '€ Update', color: 'info' },
                                            ].map(({ key, label, color }) => (
                                                <Chip
                                                    key={key}
                                                    label={label}
                                                    size="small"
                                                    onClick={() => { setFilterStato(key); setPreviewPage(0); }}
                                                    color={filterStato === key ? (color as any) : 'default'}
                                                    variant={filterStato === key ? 'filled' : 'outlined'}
                                                    sx={{ cursor: 'pointer' }}
                                                />
                                            ))}
                                        </Box>

                                        {/* Sort */}
                                        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                                            <Select
                                                size="small"
                                                value={sortBy}
                                                onChange={e => { setSortBy(e.target.value); setPreviewPage(0); }}
                                                sx={{ minWidth: 130, fontSize: '0.8rem' }}
                                            >
                                                <MenuItem value="createdAt">Data creazione</MenuItem>
                                                <MenuItem value="variantPrice">Prezzo</MenuItem>
                                                <MenuItem value="variantInventoryQty">Quantità</MenuItem>
                                                <MenuItem value="title">Titolo</MenuItem>
                                                <MenuItem value="statoCaricamento">Stato</MenuItem>
                                            </Select>
                                            <Tooltip title={sortOrder === 'desc' ? 'Ordine decrescente' : 'Ordine crescente'}>
                                                <IconButton size="small" onClick={() => { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); setPreviewPage(0); }}>
                                                    {sortOrder === 'desc' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>

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
                                                        <TableCell>Azioni</TableCell>
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
                                                            <TableRow key={row.id} sx={
                                                                row.statoCaricamento === 'error' ? { backgroundColor: 'rgba(244,67,54,0.04)' } :
                                                                    row.statoCaricamento === 'blacklisted' ? { backgroundColor: 'rgba(0,0,0,0.04)', opacity: 0.65 } :
                                                                        {}
                                                            }>
                                                                <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{row.handle || 'N/D'}</Typography></TableCell>
                                                                <TableCell>
                                                                    <Tooltip title={row.title}>
                                                                        <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>{row.title || 'Senza titolo'}</Typography>
                                                                    </Tooltip>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {row.tags && typeof row.tags === 'string' ? row.tags.split(',').slice(0, 3).map((tag: string, index: number) => (
                                                                        <Chip key={index} label={tag.trim()} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                                                                    )) : '-'}
                                                                </TableCell>
                                                                <TableCell>€ {typeof row.variantPrice === 'number' ? row.variantPrice.toFixed(2) : row.variantPrice || '0.00'}</TableCell>
                                                                <TableCell>{row.variantInventoryQty || 0}</TableCell>
                                                                <TableCell>
                                                                    <Tooltip
                                                                        title={row.statoCaricamento === 'error' && row.errorMessage ? (
                                                                            <Box sx={{ fontSize: 11, maxWidth: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                                {row.errorMessage.substring(0, 400)}
                                                                            </Box>
                                                                        ) : ''}
                                                                        placement="top"
                                                                        arrow
                                                                    >
                                                                        <Chip
                                                                            label={row.statoCaricamento || 'pending'}
                                                                            size="small"
                                                                            sx={{
                                                                                cursor: row.statoCaricamento === 'error' ? 'help' : 'default',
                                                                                ...(row.statoCaricamento === 'uploaded' && { backgroundColor: '#000000', color: '#ffffff' }),
                                                                                ...(row.statoCaricamento === 'blacklisted' && { backgroundColor: '#616161', color: '#fff' }),
                                                                            }}
                                                                            color={
                                                                                row.statoCaricamento === 'uploaded' ? 'default' :
                                                                                    row.statoCaricamento === 'error' ? 'error' :
                                                                                        row.statoCaricamento === 'price_update' ? 'info' :
                                                                                            'default'
                                                                            }
                                                                        />
                                                                    </Tooltip>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {row.bodyHtml && <Tooltip title="Descrizione presente"><DescriptionIcon fontSize="small" color="action" /></Tooltip>}
                                                                    {row.immaginiUrls && <Tooltip title="Immagini presenti"><ImageIcon fontSize="small" color="action" sx={{ ml: 1 }} /></Tooltip>}
                                                                    {row.specificheJson && <Tooltip title="Specifiche tecniche estratte"><MemoryIcon fontSize="small" color="action" sx={{ ml: 1 }} /></Tooltip>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                        {/* 👁 Preview */}
                                                                        <Tooltip title="Anteprima prodotto">
                                                                            <IconButton size="small" onClick={() => handlePreview(row.id)}>
                                                                                <VisibilityIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        {/* 📈 Storico prezzi */}
                                                                        {row.masterFileId && (
                                                                            <Tooltip title="Storico prezzi">
                                                                                <IconButton size="small" onClick={() => handlePriceHistory(row.masterFileId, row.title)}>
                                                                                    <HistoryIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        )}
                                                                        {/* 🚫 Blacklist */}
                                                                        <Tooltip title={row.statoCaricamento === 'blacklisted' ? 'Riattiva prodotto' : 'Escludi dalla sync'}>
                                                                            <IconButton
                                                                                size="small"
                                                                                color={row.statoCaricamento === 'blacklisted' ? 'primary' : 'default'}
                                                                                disabled={blacklisting.has(row.id)}
                                                                                onClick={() => handleBlacklist(row.id)}
                                                                            >
                                                                                {blacklisting.has(row.id) ? <CircularProgress size={14} /> : <BlockIcon fontSize="small" />}
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        {/* 🤖 AI Review (#15) */}
                                                                        {row.isAiEnriched && (
                                                                            <Tooltip title={row.aiReviewStatus === 'approved' ? 'AI Review passata' : row.aiReviewStatus === 'flagged' ? 'Problemi trovati in AI Review' : 'Avvia AI Review (Critic)'}>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    color={row.aiReviewStatus === 'approved' ? 'success' : row.aiReviewStatus === 'flagged' ? 'warning' : 'secondary'}
                                                                                    disabled={aiReviewing.has(row.id)}
                                                                                    onClick={() => handleAiReview(row.id)}
                                                                                >
                                                                                    {aiReviewing.has(row.id) ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon fontSize="small" />}
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        )}
                                                                        {/* 🔁 Retry (solo per errori) */}
                                                                        {row.statoCaricamento === 'error' && (
                                                                            <Tooltip title={retrying.has(row.id) ? 'Retry in corso...' : 'Riprova sincronizzazione'}>
                                                                                <Chip
                                                                                    label={retrying.has(row.id) ? '...' : 'Riprova'}
                                                                                    size="small"
                                                                                    color="error"
                                                                                    variant="outlined"
                                                                                    onClick={() => !retrying.has(row.id) && handleRetry(row.id)}
                                                                                    icon={retrying.has(row.id) ? <CircularProgress size={10} color="inherit" /> : <ReplayIcon fontSize="inherit" />}
                                                                                    sx={{ cursor: retrying.has(row.id) ? 'wait' : 'pointer', fontWeight: 600 }}
                                                                                />
                                                                            </Tooltip>
                                                                        )}
                                                                    </Box>
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

                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
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

                                        {/* 🛑 STOP SYNC — visibile solo quando la sync è in corso */}
                                        {syncing && (
                                            <Button
                                                variant="contained"
                                                color="error"
                                                startIcon={cancelling ? <CircularProgress size={20} color="inherit" /> : <StopIcon />}
                                                onClick={handleCancelSync}
                                                disabled={cancelling}
                                                sx={{ px: 3, fontWeight: 700 }}
                                            >
                                                {cancelling ? 'Arresto...' : 'Stop Sync'}
                                            </Button>
                                        )}

                                        {/* 🔄 RESET DB — sempre visibile */}
                                        <Button
                                            variant="outlined"
                                            color="warning"
                                            startIcon={resetting ? <CircularProgress size={20} color="inherit" /> : <DeleteForeverIcon />}
                                            onClick={() => setOpenResetConfirm(true)}
                                            disabled={resetting || syncing}
                                            sx={{ px: 3, borderColor: '#ff9800', color: '#ff9800', '&:hover': { borderColor: '#e65100', color: '#e65100', backgroundColor: 'rgba(255,152,0,0.05)' } }}
                                        >
                                            Reset DB Shopify
                                        </Button>

                                        <Button
                                            variant="contained"
                                            startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon sx={{ color: '#FFD700' }} />}
                                            onClick={handleOpenSyncConfirm}
                                            disabled={syncing}
                                            sx={{ px: 4 }}
                                        >
                                            Sincronizza con Shopify
                                        </Button>
                                    </Box>

                                    {/* ✅ Sync Confirmation Dialog */}
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

                                    {/* 🔴 Reset Confirmation Dialog */}
                                    <Dialog
                                        open={openResetConfirm}
                                        onClose={() => setOpenResetConfirm(false)}
                                        aria-labelledby="reset-dialog-title"
                                    >
                                        <DialogTitle id="reset-dialog-title" sx={{ color: 'error.main', fontWeight: 700 }}>
                                            ⚠️ Reset Database Shopify
                                        </DialogTitle>
                                        <DialogContent>
                                            <DialogContentText sx={{ mb: 2 }}>
                                                <strong>Questa operazione azzera tutti i record di output Shopify:</strong>
                                            </DialogContentText>
                                            <Alert severity="warning" sx={{ mb: 2 }}>
                                                • Tutti i prodotti torneranno a stato <strong>"pending"</strong><br />
                                                • Gli <strong>ID Shopify salvati</strong> verranno cancellati<br />
                                                • La prossima sync <strong>CREERÀ nuovi prodotti</strong> su Shopify<br />
                                                • Usare SOLO dopo aver <strong>eliminato manualmente tutti i prodotti</strong> dal pannello Shopify
                                            </Alert>
                                            <DialogContentText>
                                                Hai già eliminato tutti i prodotti dal tuo negozio Shopify?
                                            </DialogContentText>
                                        </DialogContent>
                                        <DialogActions>
                                            <Button onClick={() => setOpenResetConfirm(false)} color="inherit">
                                                Annulla
                                            </Button>
                                            <Button onClick={handleConfirmReset} variant="contained" color="error" startIcon={<DeleteForeverIcon />}>
                                                Sì, Reset Completo
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

                                    {/* 📡 Live Log Panel */}
                                    {syncLogs.length > 0 && (
                                        <Box sx={{ mt: 2, width: '100%' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', letterSpacing: 1, textTransform: 'uppercase' }}>
                                                    📡 Live Sync Log
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{ cursor: 'pointer', color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
                                                    onClick={() => setSyncLogs([])}
                                                >
                                                    ✕ chiudi
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    background: '#0d1117',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: 2,
                                                    p: 1.5,
                                                    maxHeight: 280,
                                                    overflowY: 'auto',
                                                    fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
                                                    fontSize: '11.5px',
                                                    lineHeight: 1.7,
                                                    '&::-webkit-scrollbar': { width: '4px' },
                                                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                                                    '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '2px' },
                                                }}
                                            >
                                                {syncLogs.map((entry, i) => {
                                                    const colorMap: Record<string, string> = {
                                                        success: '#4caf50',
                                                        error: '#f44336',
                                                        warning: '#ff9800',
                                                        batch: '#64b5f6',
                                                        info: '#b0bec5',
                                                    };
                                                    const color = colorMap[entry.level] || '#b0bec5';
                                                    const time = new Date(entry.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                    return (
                                                        <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.25 }}>
                                                            <Box component="span" sx={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, userSelect: 'none' }}>
                                                                {time}
                                                            </Box>
                                                            <Box component="span" sx={{ color }}>
                                                                {entry.msg}
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                                <div ref={syncLogsEndRef} />
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

            {/* ─────────────────────────────────────────────────────────── */}
            {/* 👁️ FEATURE #5: PRODUCT PREVIEW DRAWER                       */}
            {/* ─────────────────────────────────────────────────────────── */}
            <Drawer
                anchor="right"
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                PaperProps={{ sx: { width: { xs: '100vw', md: 600 }, p: 0 } }}
            >
                {previewLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                    </Box>
                ) : previewProduct ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* Header */}
                        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                                <Typography variant="h6" fontWeight={700} sx={{ maxWidth: 480 }}>{previewProduct.title}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Chip label={previewProduct.vendor || 'N/D'} size="small" variant="outlined" />
                                    <Chip label={previewProduct.productType || 'N/D'} size="small" color="primary" variant="outlined" />
                                    <Chip label={`€ ${typeof previewProduct.variantPrice === 'number' ? previewProduct.variantPrice.toFixed(2) : previewProduct.variantPrice}`} size="small" color="success" />
                                    <Chip label={`${previewProduct.variantInventoryQty || 0} pz`} size="small" />
                                    {previewProduct.shopifyProductId && (
                                        <Chip
                                            label="Apri su Shopify"
                                            size="small"
                                            color="default"
                                            icon={<OpenInNewIcon fontSize="small" />}
                                            onClick={() => window.open(`https://${previewProduct.masterFile?.fornitoreSelezionato?.nomeFornitore || ''}/products/${previewProduct.handle}`, '_blank')}
                                            sx={{ cursor: 'pointer' }}
                                        />
                                    )}
                                </Box>
                            </Box>
                            <IconButton onClick={() => setPreviewOpen(false)}><CloseIcon /></IconButton>
                        </Box>

                        {/* Tabs */}
                        <Tabs value={previewTab} onChange={(_, v) => setPreviewTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
                            <Tab label="Descrizione" />
                            <Tab label="Immagini" />
                            <Tab label="Metafields" />
                        </Tabs>

                        {/* Tab content */}
                        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                            {previewTab === 0 && (
                                <Box>
                                    {previewProduct.bodyHtml ? (
                                        <Box
                                            sx={{ fontSize: 14, lineHeight: 1.7, '& table': { width: '100%', borderCollapse: 'collapse' }, '& td': { border: '1px solid #ddd', p: '6px' }, '& img': { maxWidth: '100%' } }}
                                            dangerouslySetInnerHTML={{ __html: previewProduct.bodyHtml }}
                                        />
                                    ) : (
                                        <Typography color="text.secondary">Nessuna descrizione disponibile.</Typography>
                                    )}
                                </Box>
                            )}
                            {previewTab === 1 && (
                                <Box>
                                    {previewProduct.immaginiUrls ? (() => {
                                        try {
                                            const urls: string[] = JSON.parse(previewProduct.immaginiUrls);
                                            return (
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
                                                    {urls.map((url, i) => (
                                                        <Box key={i} component="a" href={url} target="_blank" sx={{ display: 'block', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                                                            <Box component="img" src={url} alt={`img-${i}`} sx={{ width: '100%', height: 140, objectFit: 'contain', display: 'block' }} />
                                                        </Box>
                                                    ))}
                                                </Box>
                                            );
                                        } catch { return <Typography color="text.secondary">Errore parsing immagini.</Typography>; }
                                    })() : <Typography color="text.secondary">Nessuna immagine disponibile.</Typography>}
                                </Box>
                            )}
                            {previewTab === 2 && (
                                <Box>
                                    {previewProduct.metafieldsJson ? (() => {
                                        try {
                                            const meta = JSON.parse(previewProduct.metafieldsJson);
                                            return (
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 700 }}>Chiave</TableCell>
                                                            <TableCell sx={{ fontWeight: 700 }}>Valore</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {Object.entries(meta).map(([k, v]) => (
                                                            <TableRow key={k}>
                                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: 'primary.main' }}>{k}</TableCell>
                                                                <TableCell>
                                                                    <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 300, display: 'block' }}>
                                                                        {String(v).substring(0, 200)}{String(v).length > 200 ? '...' : ''}
                                                                    </Typography>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            );
                                        } catch { return <Typography color="text.secondary">Errore parsing metafields.</Typography>; }
                                    })() : <Typography color="text.secondary">Nessun metafield disponibile.</Typography>}
                                </Box>
                            )}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">Nessun prodotto selezionato</Typography>
                    </Box>
                )}
            </Drawer>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* 📈 FEATURE #7: PRICE HISTORY DIALOG                         */}
            {/* ─────────────────────────────────────────────────────────── */}
            <Dialog open={priceHistoryOpen} onClose={() => setPriceHistoryOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h6" fontWeight={700}>📈 Storico Prezzi</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{priceHistoryProduct}</Typography>
                        </Box>
                        <IconButton onClick={() => setPriceHistoryOpen(false)}><CloseIcon /></IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    {priceHistoryLoading ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : priceHistory.length === 0 ? (
                        <Alert severity="info">Nessuna variazione di prezzo registrata. Le variazioni vengono registrate automaticamente a ogni ricalcolo.</Alert>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Data</TableCell>
                                    <TableCell>Prezzo Acquisto</TableCell>
                                    <TableCell>Vecchio</TableCell>
                                    <TableCell>Nuovo</TableCell>
                                    <TableCell>Δ</TableCell>
                                    <TableCell>Markup</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {priceHistory.map(h => {
                                    const delta = h.prezzoNuovo - h.prezzoVecchio;
                                    const deltaColor = delta > 0 ? '#4caf50' : delta < 0 ? '#f44336' : 'text.secondary';
                                    return (
                                        <TableRow key={h.id}>
                                            <TableCell sx={{ fontSize: 11 }}>{new Date(h.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                            <TableCell>€ {h.prezzoAcquisto?.toFixed(2)}</TableCell>
                                            <TableCell>€ {h.prezzoVecchio?.toFixed(2)}</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>€ {h.prezzoNuovo?.toFixed(2)}</TableCell>
                                            <TableCell sx={{ color: deltaColor, fontWeight: 600 }}>
                                                {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: 11 }}>{h.markupPercentuale != null ? `${h.markupPercentuale}%` : '-'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPriceHistoryOpen(false)}>Chiudi</Button>
                </DialogActions>
            </Dialog>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* 🗂️ FEATURE #8: CATEGORY MAPPING DIALOG                      */}
            {/* ─────────────────────────────────────────────────────────── */}
        </Box>
    );
}
