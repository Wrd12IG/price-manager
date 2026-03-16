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
    Divider
} from '@mui/material';
import {
    Merge as MergeIcon,
    CompareArrows as CompareIcon,
    Warning as WarningIcon,
    Search as SearchIcon,
    AutoFixHigh as MagicIcon,
    Info as InfoIcon,
    DeleteSweep as CleanupIcon
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

    const type = tab === 0 ? 'brand' : 'category';

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, dupsRes] = await Promise.all([
                api.get(`/normalization/stats/${type}`),
                api.get(`/normalization/duplicates/${type}`)
            ]);
            setStats(statsRes.data);
            setDuplicates(dupsRes.data);
        } catch (error) {
            toast.error('Errore nel caricamento dei dati');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        if (query.length < 1) return;  // P3: Abbassato da 2 a 1 carattere
        setSearchLoading(true);
        try {
            const res = await api.get(`/normalization/search/${type}?q=${query}`);
            setSearchOptions(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setSearchLoading(false);
        }
    };

    // P3: Pre-caricamento top items quando l'utente apre il dropdown
    const handleDropdownOpen = async () => {
        if (searchOptions.length === 0) {
            setSearchLoading(true);
            try {
                const res = await api.get(`/normalization/search/${type}`);
                setSearchOptions(res.data);
            } catch (error) {
                console.error(error);
            } finally {
                setSearchLoading(false);
            }
        }
    };

    // P2b: Pulizia marchi/categorie orfane
    const handleCleanOrphans = async () => {
        try {
            const res = await api.delete(`/normalization/clean-orphans/${type}`);
            toast.success(`Rimossi ${res.data.deleted} ${type === 'brand' ? 'marchi' : 'categorie'} senza prodotti`);
            fetchData();
        } catch (error) {
            toast.error('Errore durante la pulizia');
        }
    };

    // P3b: Auto-normalizzazione batch via Icecat
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
                    Normalizzazione Catalogo
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
                            Pulizia Orfani
                        </Button>
                    </Tooltip>
                    <Tooltip title="Usa i dati Icecat per pulire il catalogo automaticamente">
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<MagicIcon />}
                            onClick={handleAutoNormalize}
                            sx={{ mr: 1 }}
                            disabled={loading || type !== 'category'}
                        >
                            Auto-Normalizza Icecat
                        </Button>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<InfoIcon />}
                        onClick={() => toast.info('Questa sezione permette di pulire il catalogo unendo marchi o categorie simili.')}
                    >
                        Guida
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ mb: 4 }}>
                <Tabs value={tab} onChange={(_, val) => setTab(val)} centered>
                    <Tab label="Marchi (Brand)" />
                    <Tab label="Categorie" />
                </Tabs>
            </Paper>

            {/* Merge Manuale UI */}
            <Paper sx={{ p: 3, mb: 4, bgcolor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                    <SearchIcon sx={{ mr: 1 }} /> Unione Manuale Rapida
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={3}>
                    Seleziona due elementi per unirli manualmente, anche se l'algoritmo non li suggerisce.
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
                            <TextField 
                                {...params} 
                                label={`Elemento SORGENTE (da eliminare)`} 
                                variant="outlined" 
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                    />

                    <CompareIcon sx={{ color: 'text.secondary', mx: 1 }} />

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
                            <TextField 
                                {...params} 
                                label="Elemento TARGET (da mantenere)" 
                                variant="outlined" 
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                    />
                    <Button 
                        variant="contained" 
                        color="primary" 
                        disabled={!manualSource || !manualTarget || manualSource.id === manualTarget.id}
                        startIcon={<MergeIcon />}
                        onClick={() => setMergeDialog({ open: true, source: manualSource, target: manualTarget, type })}
                    >
                        Unisci
                    </Button>
                </Box>
            </Paper>

            {/* Sezione Duplicati Suggeriti */}
            {duplicates.length > 0 && (
                <Box mb={4}>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                        <MagicIcon sx={{ mr: 1, color: 'purple' }} />
                        Duplicati Suggeriti ({duplicates.length})
                    </Typography>
                    <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(450px, 1fr))" gap={2}>
                        {duplicates.map((dup, idx) => (
                            <Paper key={idx} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '5px solid purple' }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle2" color="purple" fontWeight="bold" sx={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                        {dup.reason}
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                        <Typography variant="body1" fontWeight="bold">{dup.item1.nome}</Typography>
                                        <CompareIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                                        <Typography variant="body1" fontWeight="bold">{dup.item2.nome}</Typography>
                                    </Box>
                                </Box>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<MergeIcon />}
                                    onClick={() => setMergeDialog({ open: true, source: dup.item1, target: dup.item2, type })}
                                >
                                    Unisci
                                </Button>
                            </Paper>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Tabella Completa */}
            <TableContainer component={Paper}>
                <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Elenco Completo {tab === 0 ? 'Marchi' : 'Categorie'}</Typography>
                </Box>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Nome</TableCell>
                            <TableCell align="center">Prodotti</TableCell>
                            {type === 'category' && <TableCell>Suggerimento Icecat</TableCell>}
                            <TableCell>Alias Attivi</TableCell>
                            <TableCell align="right">Azioni</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <CircularProgress sx={{ my: 4 }} />
                                </TableCell>
                            </TableRow>
                        ) : stats.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">Nessun dato trovato</TableCell>
                            </TableRow>
                        ) : (
                            stats.map((item) => (
                                <TableRow key={item.id} hover>
                                    <TableCell>
                                        <Typography fontWeight="500">{item.nome}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={item._count?.masterFiles || 0}
                                            size="small"
                                            color={item._count?.masterFiles > 0 ? "primary" : "default"}
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    {type === 'category' && (
                                        <TableCell>
                                            {item.icecatSuggestion ? (
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Chip label={item.icecatSuggestion} size="small" component="span" sx={{ bgcolor: 'purple', color: 'white', fontWeight: 'bold' }} />
                                                    {item.nome !== item.icecatSuggestion && (
                                                        <Tooltip title={`Unisci a ${item.icecatSuggestion}`}>
                                                            <IconButton 
                                                                size="small" 
                                                                color="primary"
                                                                onClick={async () => {
                                                                    const target = stats.find(s => s.nome.toLowerCase() === item.icecatSuggestion.toLowerCase());
                                                                    if (target) {
                                                                        setMergeDialog({ open: true, source: item, target, type });
                                                                    } else {
                                                                        toast.warning(`La categoria target "${item.icecatSuggestion}" non esiste ancora. Verrà creata nel prossimo consolidamento.`);
                                                                    }
                                                                }}
                                                            >
                                                                <MagicIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            ) : '-'}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                                            {item.aliases?.map((a: any) => (
                                                <Chip key={a.id} label={a.alias} size="small" variant="outlined" />
                                            ))}
                                            {(!item.aliases || item.aliases.length === 0) && '-'}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => {
                                            setManualSource(item);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                            toast.info(`${item.nome} selezionato come sorgente.`);
                                        }}>
                                            <MergeIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Dialog Unione */}
            <Dialog open={mergeDialog.open} onClose={() => setMergeDialog({ ...mergeDialog, open: false })} maxWidth="sm" fullWidth>
                <DialogTitle>Conferma Unione {type === 'brand' ? 'Marchi' : 'Categorie'}</DialogTitle>
                <DialogContent>
                    <Box textAlign="center" py={2}>
                        <Box display="flex" justifyContent="center" alignItems="center" gap={3} my={2}>
                            <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'white', minWidth: 120 }}>
                                <Typography fontWeight="bold">{mergeDialog.source?.nome}</Typography>
                                <Typography variant="caption">Sorgente</Typography>
                            </Paper>
                            <MergeIcon fontSize="large" color="action" />
                            <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'white', minWidth: 120 }}>
                                <Typography fontWeight="bold">{mergeDialog.target?.nome}</Typography>
                                <Typography variant="caption">Target</Typography>
                            </Paper>
                        </Box>
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            Questa operazione è irreversibile. Tutti i prodotti di <b>{mergeDialog.source?.nome}</b> passeranno a <b>{mergeDialog.target?.nome}</b> e verrà creato un alias automatico per le future importazioni.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMergeDialog({ ...mergeDialog, open: false })}>Annulla</Button>
                    <Button variant="contained" color="primary" onClick={() => handleMerge(true)}>
                        Conferma ed Unisci
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Normalization;
