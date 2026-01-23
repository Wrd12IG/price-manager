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
    DialogActions
} from '@mui/material';
import {
    Search as SearchIcon,
    Merge as MergeIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
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
    nomeProdotto: string;
    prezzoAcquistoMigliore: number;
    prezzoVenditaCalcolato: number;
    quantitaTotaleAggregata: number;
    marca: string | null;
    categoriaEcommerce: string | null;
    fornitoreSelezionato: {
        nomeFornitore: string;
    };
    datiIcecat?: {
        descrizioneLunga: string | null;
        urlImmaginiJson: string | null;
    } | null;
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

    useEffect(() => {
        fetchProducts();
    }, [page, rowsPerPage, searchTerm]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/master-file', {
                params: {
                    page: page + 1,
                    limit: rowsPerPage,
                    search: searchTerm
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
            const response = await api.post('/api/master-file/consolidate');
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
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Cerca per Nome, EAN, SKU o Marca..."
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
            </Paper>

            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                <TableCell sx={{ fontWeight: 600 }}>EAN / SKU</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Miglior Fornitore</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Prezzo Acquisto</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Prezzo Vendita</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Stock Totale</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Ultimo Agg.</TableCell>
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
                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="body2">{product.eanGtin}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    SKU: {product.skuSelezionato}
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
                                            <Typography variant="body2" fontWeight={600}>
                                                € {product.prezzoAcquistoMigliore.toFixed(2)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const hasMarkup = product.prezzoVenditaCalcolato > product.prezzoAcquistoMigliore;
                                                const markupPercent = hasMarkup
                                                    ? ((product.prezzoVenditaCalcolato - product.prezzoAcquistoMigliore) / product.prezzoAcquistoMigliore * 100).toFixed(1)
                                                    : 0;

                                                return (
                                                    <Tooltip title={hasMarkup ? `Markup applicato: +${markupPercent}%` : 'Nessun markup applicato'}>
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight={700}
                                                            sx={{
                                                                color: hasMarkup ? 'success.main' : 'text.primary',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 0.5
                                                            }}
                                                        >
                                                            € {product.prezzoVenditaCalcolato.toFixed(2)}
                                                            {hasMarkup && (
                                                                <Typography component="span" variant="caption" sx={{ color: 'success.light', fontWeight: 500 }}>
                                                                    (+{markupPercent}%)
                                                                </Typography>
                                                            )}
                                                        </Typography>
                                                    </Tooltip>
                                                );
                                            })()}
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
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(product.updatedAt).toLocaleDateString()}
                                            </Typography>
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
