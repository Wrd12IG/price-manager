import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Box,
    Paper,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
    Tooltip,
    TextField,
    Autocomplete,
    Grid
} from '@mui/material';
import {
    Merge as MergeIcon,
    CompareArrows as CompareIcon,
    Warning as WarningIcon,
    Search as SearchIcon,
    AutoFixHigh as MagicIcon,
    Info as InfoIcon,
    DeleteSweep as CleanupIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

const Normalization: React.FC = () => {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]);
    
    // Merge Manuale State
    const [manualSource, setManualSource] = useState<any>(null);
    const [manualTarget, setManualTarget] = useState<any>(null);
    const [searchOptions, setSearchOptions] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const [mergeDialog, setMergeDialog] = useState<{
        open: boolean;
        source: any;
        target: any;
        type: 'brand' | 'category';
    }>({ open: false, source: null, target: null, type: 'brand' });

    // Quality Hub State
    const [qualityIssues, setQualityIssues] = useState<any[]>([]);
    const [qualityLoading, setQualityLoading] = useState(false);

    // Tipo risorsa per le API (brand o category)
    const resourceType = tab === 0 ? 'brand' : 'category';

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tab < 2) {
                const [statsRes, dupsRes] = await Promise.all([
                    api.get(`/normalization/stats/${resourceType}`),
                    api.get(`/normalization/duplicates/${resourceType}`)
                ]);
                setStats(statsRes.data);
                setDuplicates(dupsRes.data);
            } else {
                fetchQualityIssues();
            }
        } catch (error) {
            toast.error('Errore nel caricamento dei dati');
        } finally {
            setLoading(false);
        }
    };

    const fetchQualityIssues = async () => {
        setQualityLoading(true);
        try {
            const res = await api.get('/normalization/quality-issues');
            setQualityIssues(res.data);
        } catch (e) {
            toast.error('Errore caricamento suggerimenti qualità');
        } finally {
            setQualityLoading(false);
        }
    };

    const handleApplyFixes = async () => {
        setLoading(true);
        try {
            await api.post('/normalization/quality-fixes', {
                fixes: qualityIssues.map(q => ({
                    masterFileId: q.masterFileId,
                    suggestedCategory: q.suggestedCategory
                }))
            });
            toast.success('Suggerimenti AI applicati con successo');
            fetchQualityIssues();
        } catch (e) {
            toast.error('Errore durante l\'applicazione dei suggerimenti');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        if (query.length < 1) return;
        setSearchLoading(true);
        try {
            const res = await api.get(`/normalization/search/${resourceType}?q=${query}`);
            setSearchOptions(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleDropdownOpen = async () => {
        if (searchOptions.length === 0) {
            setSearchLoading(true);
            try {
                const res = await api.get(`/normalization/search/${resourceType}`);
                setSearchOptions(res.data);
            } catch (error) {
                console.error(error);
            } finally {
                setSearchLoading(false);
            }
        }
    };

    const handleCleanOrphans = async () => {
        try {
            const res = await api.delete(`/normalization/clean-orphans/${resourceType}`);
            toast.success(`Rimossi ${res.data.deleted} ${resourceType === 'brand' ? 'marchi' : 'categorie'} senza prodotti`);
            fetchData();
        } catch (error) {
            toast.error('Errore durante la pulizia');
        }
    };

    const handleAutoNormalize = async () => {
        setLoading(true);
        try {
            const res = await api.post('/normalization/auto-normalize');
            toast.success(`Normalizzazione completata: ${res.data.merged} categorie unite con successo.`);
            fetchData();
        } catch (error) {
            toast.error('Errore durante la normalizzazione automatica');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setManualSource(null);
        setManualTarget(null);
    }, [tab]);

    const handleMerge = async (global: boolean = true) => {
        try {
            await api.post(`/normalization/merge/${mergeDialog.type}`, {
                sourceId: mergeDialog.source.id,
                targetId: mergeDialog.target.id,
                global
            });
            toast.success('Unione completata con successo');
            setMergeDialog({ ...mergeDialog, open: false });
            setManualSource(null);
            setManualTarget(null);
            fetchData();
        } catch (error) {
            toast.error('Errore durante l\'unione');
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h4" fontWeight="bold" color="primary">
                    Qualità & Normalizzazione
                </Typography>
                <Box>
                    <Tooltip title="Rimuovi marchi/categorie con 0 prodotti">
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<CleanupIcon />}
                            onClick={handleCleanOrphans}
                            sx={{ mr: 1 }}
                        >
                            Orfani
                        </Button>
                    </Tooltip>
                    <Tooltip title="Usa i dati Icecat per pulire il catalogo automaticamente">
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<MagicIcon />}
                            onClick={handleAutoNormalize}
                            sx={{ mr: 1 }}
                            disabled={loading || resourceType !== 'category'}
                        >
                            Auto-Icecat
                        </Button>
                    </Tooltip>
                </Box>
            </Box>

            <Paper sx={{ mb: 4 }}>
                <Tabs value={tab} onChange={(_, val) => setTab(val)} centered>
                    <Tab label="Marchi" />
                    <Tab label="Categorie" />
                    <Tab label="Hub Qualità (AI Blocked)" />
                </Tabs>
            </Paper>

            {tab < 2 ? (
                <Box>
                    {/* Merge Manuale UI */}
                    <Paper sx={{ p: 3, mb: 4, bgcolor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                        <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                            <SearchIcon sx={{ mr: 1 }} /> Unione Manuale
                        </Typography>
                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                            <Autocomplete
                                sx={{ flex: 1, minWidth: 250 }}
                                options={searchOptions}
                                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.nome || ''}${option._count?.masterFiles !== undefined ? ` (${option._count.masterFiles})` : ''}`}
                                loading={searchLoading}
                                filterOptions={(x) => x}
                                value={manualSource}
                                onOpen={handleDropdownOpen}
                                onInputChange={(_, val) => handleSearch(val)}
                                onChange={(_, val) => setManualSource(val)}
                                renderInput={(params) => (
                                    <TextField {...params} label="SORGENTE" variant="outlined" size="small" />
                                )}
                            />
                            <CompareIcon sx={{ color: 'text.secondary' }} />
                            <Autocomplete
                                sx={{ flex: 1, minWidth: 250 }}
                                options={searchOptions}
                                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.nome || ''}${option._count?.masterFiles !== undefined ? ` (${option._count.masterFiles})` : ''}`}
                                loading={searchLoading}
                                filterOptions={(x) => x}
                                value={manualTarget}
                                onOpen={handleDropdownOpen}
                                onInputChange={(_, val) => handleSearch(val)}
                                onChange={(_, val) => setManualTarget(val)}
                                renderInput={(params) => (
                                    <TextField {...params} label="TARGET" variant="outlined" size="small" />
                                )}
                            />
                            <Button 
                                variant="contained" 
                                color="primary" 
                                disabled={!manualSource || !manualTarget || manualSource.id === manualTarget.id}
                                startIcon={<MergeIcon />}
                                onClick={() => setMergeDialog({ open: true, source: manualSource, target: manualTarget, type: resourceType })}
                            >
                                Unisci
                            </Button>
                        </Box>
                    </Paper>

                    {/* Suggerimenti Duplicati */}
                    {duplicates.length > 0 && (
                        <Box mb={4}>
                            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                                <MagicIcon sx={{ mr: 1, color: 'purple' }} /> Suggerimenti Smart ({duplicates.length})
                            </Typography>
                            <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(400px, 1fr))" gap={2}>
                                {duplicates.map((dup, idx) => (
                                    <Paper key={idx} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '5px solid purple' }}>
                                        <Box>
                                            <Typography variant="caption" color="purple" fontWeight="bold">{dup.reason}</Typography>
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="body2" fontWeight="bold">{dup.item1.nome}</Typography>
                                                <CompareIcon sx={{ fontSize: 14 }} />
                                                <Typography variant="body2" fontWeight="bold">{dup.item2.nome}</Typography>
                                            </Box>
                                        </Box>
                                        <Button size="small" variant="outlined" onClick={() => setMergeDialog({ open: true, source: dup.item1, target: dup.item2, type: resourceType })}>Unisci</Button>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* Tabella Completa */}
                    <TableContainer component={Paper}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Nome</TableCell>
                                    <TableCell align="center">Prodotti</TableCell>
                                    {resourceType === 'category' && <TableCell>Icecat Suggestion</TableCell>}
                                    <TableCell align="right">Azioni</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} align="center"><CircularProgress sx={{ my: 2 }}/></TableCell></TableRow>
                                ) : stats.map((item) => (
                                    <TableRow key={item.id} hover>
                                        <TableCell><Typography variant="body2" fontWeight="500">{item.nome}</Typography></TableCell>
                                        <TableCell align="center"><Chip label={item._count?.masterFiles || 0} size="small" variant="outlined" /></TableCell>
                                        {resourceType === 'category' && (
                                            <TableCell>
                                                {item.icecatSuggestion ? (
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Chip label={item.icecatSuggestion} size="small" sx={{ bgcolor: 'purple', color: 'white' }} />
                                                        {item.nome !== item.icecatSuggestion && (
                                                            <IconButton size="small" color="secondary" onClick={() => {
                                                                const target = stats.find(s => s.nome.toLowerCase() === item.icecatSuggestion.toLowerCase());
                                                                if (target) setMergeDialog({ open: true, source: item, target, type: 'category' });
                                                                else toast.warning("La categoria target non esiste ancora in questa lista.");
                                                            }}>
                                                                <MagicIcon fontSize="small" />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                ) : '-'}
                                            </TableCell>
                                        )}
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => { setManualSource(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                                                <MergeIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            ) : (
                <Box>
                    <Alert severity="info" sx={{ mb: 3 }}>
                        Prodotti bloccati per la sincronizzazione Shopify a causa di dati incompleti o categorie generiche.
                    </Alert>

                    {qualityLoading ? (
                        <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
                    ) : qualityIssues.length === 0 ? (
                        <Paper sx={{ p: 10, textAlign: 'center' }}>
                            <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                            <Typography>Nessun prodotto bloccato per qualità.</Typography>
                        </Paper>
                    ) : (
                        <Box>
                            <Box display="flex" justifyContent="flex-end" mb={2}>
                                <Button variant="contained" color="primary" startIcon={<MagicIcon />} onClick={handleApplyFixes} disabled={loading}>
                                    Applica Suggerimenti AI ({qualityIssues.length})
                                </Button>
                            </Box>
                            <TableContainer component={Paper}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Titolo Prodotto</TableCell>
                                            <TableCell>Cat. Attuale</TableCell>
                                            <TableCell>Suggerimento AI</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {qualityIssues.map((q, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{q.title}</TableCell>
                                                <TableCell><Chip label={q.currentCategory} size="small" /></TableCell>
                                                <TableCell><Chip label={q.suggestedCategory} color="primary" variant="outlined" size="small" /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Box>
            )}

            <Dialog open={mergeDialog.open} onClose={() => setMergeDialog({ ...mergeDialog, open: false })} maxWidth="xs" fullWidth>
                <DialogTitle>Conferma Unione</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">Vuoi unire <b>{mergeDialog.source?.nome}</b> in <b>{mergeDialog.target?.nome}</b>?</Typography>
                    <Alert severity="warning" sx={{ mt: 2 }}>Operazione irreversibile.</Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMergeDialog({ ...mergeDialog, open: false })}>Annulla</Button>
                    <Button variant="contained" color="primary" onClick={() => handleMerge(true)}>Unisci</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Normalization;
