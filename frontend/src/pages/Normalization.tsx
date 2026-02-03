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
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon
} from '@mui/material';
import {
    Merge as MergeIcon,
    CompareArrows as CompareIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

const Normalization: React.FC = () => {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]);
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

    useEffect(() => {
        fetchData();
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
                <Button
                    variant="outlined"
                    startIcon={<InfoIcon />}
                    onClick={() => toast.info('Questa sezione permette di pulire il catalogo unendo marchi o categorie simili.')}
                >
                    Guida
                </Button>
            </Box>

            <Paper sx={{ mb: 4 }}>
                <Tabs value={tab} onChange={(_, val) => setTab(val)} centered>
                    <Tab label="Marchi (Brand)" />
                    <Tab label="Categorie" />
                </Tabs>
            </Paper>

            {/* Sezione Duplicati Suggeriti */}
            {duplicates.length > 0 && (
                <Box mb={4}>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                        <WarningIcon sx={{ mr: 1, color: 'orange' }} />
                        Potenziali Duplicati Trovati ({duplicates.length})
                    </Typography>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        I seguenti elementi sembrano simili. Puoi unirli per mantenere il catalogo pulito.
                        Tutti i prodotti del primo elemento verranno spostati nel secondo.
                    </Alert>
                    <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(400px, 1fr))" gap={2}>
                        {duplicates.map((dup, idx) => (
                            <Paper key={idx} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '5px solid orange' }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">{dup.item1.nome}</Typography>
                                    <Typography variant="body2" color="textSecondary">ID: {dup.item1.id}</Typography>
                                </Box>
                                <CompareIcon color="action" />
                                <Box textAlign="right">
                                    <Typography variant="subtitle1" fontWeight="bold">{dup.item2.nome}</Typography>
                                    <Typography variant="body2" color="textSecondary">ID: {dup.item2.id}</Typography>
                                </Box>
                                <Button
                                    size="small"
                                    variant="contained"
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
                <Box p={2}>
                    <Typography variant="h6">Elenco Completo {tab === 0 ? 'Marchi' : 'Categorie'}</Typography>
                </Box>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Nome</TableCell>
                            <TableCell align="center">Prodotti Associati</TableCell>
                            <TableCell>Alias Attivi</TableCell>
                            <TableCell align="right">Azioni</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    <CircularProgress sx={{ my: 4 }} />
                                </TableCell>
                            </TableRow>
                        ) : stats.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center">Nessun dato trovato</TableCell>
                            </TableRow>
                        ) : (
                            stats.map((item) => (
                                <TableRow key={item.id} hover>
                                    <TableCell>
                                        <Typography fontWeight="500">{item.nome}</Typography>
                                        {item.normalizzato && (
                                            <Typography variant="caption" color="textSecondary">
                                                Normalizzato: {item.normalizzato}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={item._count?.masterFiles || 0}
                                            color={item._count?.masterFiles > 0 ? "primary" : "default"}
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {item.aliases?.map((a: any) => (
                                            <Chip
                                                key={a.id}
                                                label={a.alias}
                                                size="small"
                                                sx={{ mr: 0.5, mb: 0.5 }}
                                            />
                                        ))}
                                        {(!item.aliases || item.aliases.length === 0) && '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Usa come target per unione">
                                            <IconButton size="small" onClick={() => toast.info('Trascina un altro elemento qui (funzionalità in arrivo)')}>
                                                <MergeIcon />
                                            </IconButton>
                                        </Tooltip>
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
                        <Typography variant="subtitle1" gutterBottom>
                            Stai per unire:
                        </Typography>
                        <Box display="flex" justifyContent="center" alignItems="center" gap={3} my={2}>
                            <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'white' }}>
                                <Typography fontWeight="bold">{mergeDialog.source?.nome}</Typography>
                                <Typography variant="caption">Sorgente (Verrà eliminato)</Typography>
                            </Paper>
                            <MergeIcon fontSize="large" color="action" />
                            <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'white' }}>
                                <Typography fontWeight="bold">{mergeDialog.target?.nome}</Typography>
                                <Typography variant="caption">Target (Verrà mantenuto)</Typography>
                            </Paper>
                        </Box>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            - Tutti i prodotti associati a <b>{mergeDialog.source?.nome}</b> verranno associati a <b>{mergeDialog.target?.nome}</b>.
                            <br />
                            - Verrà creato un alias automatico: nelle future importazioni, "{mergeDialog.source?.nome}" diventerà automaticamente "{mergeDialog.target?.nome}".
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
