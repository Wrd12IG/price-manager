import { useEffect, useState } from 'react';
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
    Button,
    TextField,
    InputAdornment,
    TablePagination,
    Chip,
    CircularProgress,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Grid
} from '@mui/material';
import {
    Search as SearchIcon,
    Merge as MergeIcon,
    Refresh as RefreshIcon,
    FilterAlt as FilterIcon,
    Image as ImageIcon,
    CheckCircle as CheckIcon,
    History as HistoryIcon,
    Memory as MemoryIcon
} from '@mui/icons-material';
import { FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch } from '@mui/material';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface StockPerFornitore {
    fornitore: string;
    quantita: number;
    prezzo: number;
}

interface MasterProduct {
    id: number;
    eanGtin: string;
    skuSelezionato: string;
    partNumber: string | null;
    nomeProdotto: string;
    prezzoAcquistoMigliore: number;
    prezzoVenditaCalcolato: number;
    quantitaTotaleAggregata: number;
    marca: { id: number; nome: string } | null;
    categoria: { id: number; nome: string } | null;
    fornitoreSelezionato: {
        id: number;
        nomeFornitore: string;
    };
    datiIcecat?: {
        descrizioneLunga: string | null;
        urlImmaginiJson: string | null;
    } | null;
    outputShopify?: any | null;
    stockPerFornitore?: StockPerFornitore[];
    updatedAt: string;
}

export default function MasterFile() {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [consolidating, setConsolidating] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Pagination & Search
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [totalRows, setTotalRows] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Advanced Filters State
    const [filterOptions, setFilterOptions] = useState<{
        marchi: any[],
        categorie: any[],
        fornitori: any[]
    }>({ marchi: [], categorie: [], fornitori: [] });

    const [selectedFilters, setSelectedFilters] = useState({
        marchioId: '',
        categoriaId: '',
        fornitoreId: '',
        soloDisponibili: false
    });

    useEffect(() => {
        fetchProducts();
    }, [page, rowsPerPage, searchTerm, selectedFilters]);

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/master-file', {
                params: {
                    page: page + 1,
                    limit: rowsPerPage,
                    search: searchTerm,
                    ...selectedFilters
                }
            });
            setProducts(response.data?.data || []);
            setTotalRows(response.data.pagination.total);
        } catch (error) {
            console.error(error);
            toast.error('Errore caricamento catalogo');
        } finally {
            setLoading(false);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            const response = await api.get('/master-file/filters');
            setFilterOptions(response.data.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenConsolidateDialog = () => {
        setConfirmOpen(true);
    };

    const handleCloseConsolidateDialog = () => {
        if (!consolidating) {
            setConfirmOpen(false);
        }
    };

    const executeConsolidation = async () => {
        setConsolidating(true);
        // Toast is not needed here as we have the dialog open with loading state, 
        // but we can keep it or use the dialog to show progress.
        // Let's use toast for consistency with user expectation but keep dialog open or close it?
        // Usually, we close dialog and show toast, or keep dialog with spinner.
        // Let's close dialog and show toast to avoid blocking UI if it takes long.
        setConfirmOpen(false);

        const toastId = toast.loading('Consolidamento in corso...');

        try {
            const response = await api.post('/master-file/consolidate');
            // Check response structure carefully
            const result = response.data?.data || {};
            const processed = result.processed || 0;
            const created = result.consolidated || 0; // Backend returns 'consolidated'
            const updated = result.filtered || 0;

            toast.update(toastId, {
                render: `Consolidamento completato! Prodotti: ${created}`,
                type: 'success',
                isLoading: false,
                autoClose: 5000
            });
            fetchProducts();
        } catch (error: any) {
            console.error(error);
            toast.update(toastId, {
                render: error.response?.data?.error?.message || error.message || 'Errore durante il consolidamento',
                type: 'error',
                isLoading: false,
                autoClose: 5000
            });
        } finally {
            setConsolidating(false);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        setPage(0); // Reset to first page on search
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Master File
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Catalogo consolidato con il miglior prezzo per ogni prodotto
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchProducts}
                    >
                        Ricarica Vista
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={consolidating ? <CircularProgress size={20} color="inherit" /> : <MergeIcon sx={{ color: '#FFD700' }} />}
                        onClick={handleOpenConsolidateDialog}
                        disabled={consolidating}
                    >
                        Aggiorna con Filtri
                    </Button>
                </Box>
            </Box>

            {/* Consolidate Confirmation Dialog */}
            <Dialog
                open={confirmOpen}
                onClose={handleCloseConsolidateDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Avviare il consolidamento?"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Questa operazione applicherà i filtri attivi, selezionerà il miglior prezzo per ogni prodotto e aggiornerà il Master File.
                        <br /><br />
                        <strong>Nota:</strong> I dati esistenti nel Master File verranno rigenerati.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseConsolidateDialog} color="inherit">
                        Annulla
                    </Button>
                    <Button onClick={executeConsolidation} variant="contained" autoFocus>
                        Conferma e Avvia
                    </Button>
                </DialogActions>
            </Dialog>

            <Paper sx={{ mb: 4, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Cerca per Nome, EAN, SKU..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Marca</InputLabel>
                            <Select
                                value={selectedFilters.marchioId}
                                label="Marca"
                                onChange={(e) => setSelectedFilters({ ...selectedFilters, marchioId: e.target.value as string })}
                            >
                                <MenuItem value="">Tutte</MenuItem>
                                {filterOptions.marchi.map(m => (
                                    <MenuItem key={m.id} value={m.id}>{m.nome}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Categoria</InputLabel>
                            <Select
                                value={selectedFilters.categoriaId}
                                label="Categoria"
                                onChange={(e) => setSelectedFilters({ ...selectedFilters, categoriaId: e.target.value as string })}
                            >
                                <MenuItem value="">Tutte</MenuItem>
                                {filterOptions.categorie.map(c => (
                                    <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Fornitore</InputLabel>
                            <Select
                                value={selectedFilters.fornitoreId}
                                label="Fornitore"
                                onChange={(e) => setSelectedFilters({ ...selectedFilters, fornitoreId: e.target.value as string })}
                            >
                                <MenuItem value="">Tutti</MenuItem>
                                {filterOptions.fornitori.map(f => (
                                    <MenuItem key={f.id} value={f.id}>{f.nome}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={selectedFilters.soloDisponibili}
                                    onChange={(e) => setSelectedFilters({ ...selectedFilters, soloDisponibili: e.target.checked })}
                                    color="primary"
                                />
                            }
                            label="Disponibili"
                        />
                    </Grid>
                </Grid>
            </Paper>

            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                <TableCell sx={{ fontWeight: 600 }}>Info Prodotto</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Catalog Data</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Miglior Fornitore</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Prezzi (Acq. / Vend.)</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Stock Totale</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Stato AI</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : (products?.length || 0) === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                        <Typography color="text.secondary">
                                            Nessun prodotto nel Master File. Esegui il consolidamento.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products?.map((product) => (
                                    <TableRow key={product.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                {product.datiIcecat?.urlImmaginiJson ? (
                                                    <Box
                                                        component="img"
                                                        src={JSON.parse(product.datiIcecat.urlImmaginiJson)[0]}
                                                        sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'contain', border: '1px solid #eee' }}
                                                    />
                                                ) : (
                                                    <Box sx={{ width: 40, height: 40, borderRadius: 1, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <ImageIcon sx={{ color: '#ccc', fontSize: 20 }} />
                                                    </Box>
                                                )}
                                                <Box sx={{ maxWidth: 300 }}>
                                                    <Typography variant="body2" fontWeight={600} noWrap sx={{ display: 'block' }}>
                                                        {product.nomeProdotto || 'Nessun nome'}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                                        <Typography variant="caption" color="primary" sx={{ border: '1px solid', borderColor: 'primary.light', px: 0.5, borderRadius: 0.5 }}>
                                                            EAN: {product.eanGtin}
                                                        </Typography>
                                                        {product.partNumber && (
                                                            <Typography variant="caption" sx={{ color: '#d97706', border: '1px solid #fcd34d', px: 0.5, borderRadius: 0.5, backgroundColor: '#fffbeb' }}>
                                                                PN: {product.partNumber}
                                                            </Typography>
                                                        )}
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', backgroundColor: '#eee', px: 0.5, borderRadius: 0.5 }}>
                                                            SKU: {product.skuSelezionato}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                                                    {product.marca?.nome || 'N/D'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {product.categoria?.nome || 'N/D'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={product.fornitoreSelezionato?.nomeFornitore}
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                    borderColor: 'rgba(0, 0, 0, 0.23)',
                                                    color: '#000',
                                                    fontWeight: 500
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                                    Acq: € {product.prezzoAcquistoMigliore.toFixed(2)}
                                                </Typography>
                                                {(() => {
                                                    const hasMarkup = product.prezzoVenditaCalcolato > product.prezzoAcquistoMigliore;
                                                    const markupPercent = hasMarkup
                                                        ? ((product.prezzoVenditaCalcolato - product.prezzoAcquistoMigliore) / product.prezzoAcquistoMigliore * 100).toFixed(1)
                                                        : 0;

                                                    return (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="body2" fontWeight={700} color="success.main">
                                                                € {product.prezzoVenditaCalcolato.toFixed(2)}
                                                            </Typography>
                                                            {hasMarkup && (
                                                                <Typography variant="caption" sx={{ color: 'success.light', fontSize: '0.65rem' }}>
                                                                    (+{markupPercent}%)
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    );
                                                })()}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip
                                                title={
                                                    product.stockPerFornitore && product.stockPerFornitore.length > 0 ? (
                                                        <Box sx={{ p: 0.5 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                                                                Dettaglio Stock per Fornitore:
                                                            </Typography>
                                                            {product.stockPerFornitore
                                                                .sort((a, b) => a.fornitore.localeCompare(b.fornitore))
                                                                .map((stock, idx) => (
                                                                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                                                        <Typography variant="caption">
                                                                            {stock.fornitore}:
                                                                        </Typography>
                                                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                                            {stock.quantita} pz @ €{stock.prezzo.toFixed(2)}
                                                                        </Typography>
                                                                    </Box>
                                                                ))
                                                            }
                                                        </Box>
                                                    ) : 'Nessun dato disponibile'
                                                }
                                                arrow
                                                placement="left"
                                            >
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer' }}>
                                                    <Chip
                                                        label={product.quantitaTotaleAggregata}
                                                        size="small"
                                                        sx={{
                                                            ...(product.quantitaTotaleAggregata > 0 ? {
                                                                backgroundColor: '#000000',
                                                                color: '#ffffff',
                                                                '& .MuiChip-label': { color: '#ffffff' }
                                                            } : {
                                                                // keep error default or style it
                                                                color: 'error.main',
                                                                borderColor: 'error.main'
                                                            })
                                                        }}
                                                        color={product.quantitaTotaleAggregata > 0 ? 'default' : 'error'}
                                                        variant={product.quantitaTotaleAggregata > 0 ? 'filled' : 'outlined'}
                                                    />
                                                    {product.stockPerFornitore && product.stockPerFornitore.length > 1 && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.65rem' }}>
                                                            {product.stockPerFornitore.length} fornitori
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                {product.datiIcecat ? (
                                                    <Tooltip title="Dati Icecat Presenti">
                                                        <CheckIcon sx={{ color: '#FFD700', fontSize: 18 }} />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="Nessun dato Icecat">
                                                        <CheckIcon sx={{ color: '#eee', fontSize: 18 }} />
                                                    </Tooltip>
                                                )}
                                                {product.outputShopify ? (
                                                    <Tooltip title="Pronto per Shopify / AI Enriched">
                                                        <MemoryIcon sx={{ color: 'success.main', fontSize: 18 }} />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="AI enrichment mancante">
                                                        <MemoryIcon sx={{ color: '#eee', fontSize: 18 }} />
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
                    rowsPerPageOptions={[25, 50, 100]}
                    component="div"
                    count={totalRows}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Righe per pagina"
                />
            </Paper>
        </Box>
    );
}
