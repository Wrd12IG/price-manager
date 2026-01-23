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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Chip,
    Grid,
    CircularProgress,
    Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface RegolaMarkup {
    id: number;
    fornitoreId: number | null;
    marchioId: number | null;
    categoriaId: number | null;
    tipoRegola: string;
    riferimento: string | null;
    priorita: number;
    markupPercentuale: number;
    markupFisso: number;
    costoSpedizione: number;
    attiva: boolean;
    fornitore?: { nomeFornitore: string };
    marchio?: { nome: string };
    categoria?: { nome: string };
}

interface Fornitore {
    id: number;
    nomeFornitore: string;
}

interface Marchio {
    id: number;
    nome: string;
}

interface Categoria {
    id: number;
    nome: string;
}

export default function Pricing() {
    const [regole, setRegole] = useState<RegolaMarkup[]>([]);
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [marche, setMarche] = useState<Marchio[]>([]);
    const [categorie, setCategorie] = useState<Categoria[]>([]);

    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [ruleToDeleteId, setRuleToDeleteId] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        fornitoreId: '' as string | number, // '' = Tutti
        marchioId: null as number | null,
        categoriaId: null as number | null,
        ean: '',
        priorita: 100,
        markupPercentuale: 30,
        markupFisso: 0,
        costoSpedizione: 0,
    });

    useEffect(() => {
        fetchData();
        fetchOptions();
    }, []);

    const fetchData = async () => {
        try {
            const [regoleRes, fornitoriRes] = await Promise.all([
                api.get('/api/markup'),
                api.get('/api/fornitori')
            ]);
            setRegole(regoleRes.data.data);
            setFornitori(fornitoriRes.data.data);
        } catch (error) {
            console.error(error);
            toast.error('Errore caricamento dati');
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [marcheRes, categorieRes] = await Promise.all([
                api.get('/api/marchi?limit=2000'),
                api.get('/api/categorie?limit=2000')
            ]);
            setMarche(marcheRes.data.data);
            setCategorie(categorieRes.data.data);
        } catch (error) {
            console.error('Errore caricamento opzioni:', error);
        }
    };

    const handleOpenDialog = () => {
        setFormData({
            fornitoreId: '',
            marchioId: null,
            categoriaId: null,
            ean: '',
            priorita: 100,
            markupPercentuale: 30,
            markupFisso: 0,
            costoSpedizione: 0,
        });
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
    };

    const handleSave = async () => {
        const toastId = toast.loading('Creazione regola in corso...');

        try {
            // Determina il tipo regola per compatibilità backend
            let tipoRegola = 'default';
            if (formData.ean) tipoRegola = 'prodotto_specifico';
            else if (formData.marchioId && formData.categoriaId) tipoRegola = 'custom';
            else if (formData.marchioId) tipoRegola = 'marca';
            else if (formData.categoriaId) tipoRegola = 'categoria';
            else if (formData.fornitoreId) tipoRegola = 'fornitore';

            const payload = {
                fornitoreId: formData.fornitoreId === '' ? null : Number(formData.fornitoreId),
                marchioId: formData.marchioId,
                categoriaId: formData.categoriaId,
                riferimento: formData.ean || null,
                tipoRegola,
                priorita: formData.priorita,
                markupPercentuale: formData.markupPercentuale,
                markupFisso: formData.markupFisso,
                costoSpedizione: formData.costoSpedizione
            };

            const response = await api.post('/api/markup', payload);
            toast.update(toastId, {
                render: 'Regola creata con successo!',
                type: 'success',
                isLoading: false,
                autoClose: 4000
            });

            handleCloseDialog();
            fetchData();
        } catch (error: any) {
            toast.update(toastId, {
                render: error.response?.data?.error?.message || 'Errore creazione regola',
                type: 'error',
                isLoading: false,
                autoClose: 5000
            });
        }
    };

    const handleDeleteClick = (id: number) => {
        setRuleToDeleteId(id);
        setDeleteConfirmationOpen(true);
    };

    const confirmDelete = async () => {
        if (!ruleToDeleteId) return;

        setDeleteConfirmationOpen(false); // Close dialog immediately
        const toastId = toast.loading('Eliminazione regola in corso...');

        try {
            await api.delete(`/api/markup/${ruleToDeleteId}`);
            toast.update(toastId, {
                render: 'Regola eliminata con successo!',
                type: 'success',
                isLoading: false,
                autoClose: 4000
            });

            fetchData();
        } catch (error) {
            toast.update(toastId, {
                render: 'Errore eliminazione',
                type: 'error',
                isLoading: false,
                autoClose: 5000
            });
        } finally {
            setRuleToDeleteId(null);
        }
    };



    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Regole di Pricing
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Definisci i margini di guadagno combinando Fornitore, Marca e Categoria.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenDialog}
                    >
                        Nuova Regola
                    </Button>

                </Box>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Priorità</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Fornitore</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Marca</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Categoria</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>EAN / Extra</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Markup %</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Fisso / Sped.</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Azioni</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : regole.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                    Nessuna regola definita. Crea una regola di Default.
                                </TableCell>
                            </TableRow>
                        ) : (
                            regole.map((regola) => (
                                <TableRow key={regola.id} hover>
                                    <TableCell>{regola.priorita}</TableCell>
                                    <TableCell>
                                        {regola.fornitore ? (
                                            <Chip
                                                label={regola.fornitore.nomeFornitore}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderColor: 'rgba(0, 0, 0, 0.23)', color: '#000', fontWeight: 500 }}
                                            />
                                        ) : (
                                            <Chip label="Tutti" size="small" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {regola.marchio ? (
                                            <Chip
                                                label={regola.marchio.nome}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderColor: 'rgba(0, 0, 0, 0.23)', color: '#000', fontWeight: 500 }}
                                            />
                                        ) : (
                                            <Chip label="Tutte" size="small" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {regola.categoria ? (
                                            <Chip
                                                label={regola.categoria.nome}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderColor: 'rgba(0, 0, 0, 0.23)', color: '#000', fontWeight: 500 }}
                                            />
                                        ) : (
                                            <Chip label="Tutte" size="small" />
                                        )}
                                    </TableCell>
                                    <TableCell>{regola.riferimento || '-'}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                        +{regola.markupPercentuale}%
                                    </TableCell>
                                    <TableCell>
                                        € {regola.markupFisso} / € {regola.costoSpedizione}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(regola.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                <DialogTitle>Nuova Regola di Pricing</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Lascia i campi vuoti per applicare la regola a "Tutti".
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth>
                                    <InputLabel>Fornitore</InputLabel>
                                    <Select
                                        value={formData.fornitoreId}
                                        label="Fornitore"
                                        onChange={(e) => setFormData({ ...formData, fornitoreId: e.target.value })}
                                    >
                                        <MenuItem value=""><em>Tutti i Fornitori</em></MenuItem>
                                        {fornitori.map((f) => (
                                            <MenuItem key={f.id} value={f.id}>{f.nomeFornitore}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Autocomplete
                                    options={marche}
                                    getOptionLabel={(option) => option.nome}
                                    value={marche.find(m => m.id === formData.marchioId) || null}
                                    onChange={(_, newValue) => setFormData({ ...formData, marchioId: newValue ? newValue.id : null })}
                                    renderInput={(params) => <TextField {...params} label="Marca (Opzionale)" fullWidth />}
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Autocomplete
                                    options={categorie}
                                    getOptionLabel={(option) => option.nome}
                                    value={categorie.find(c => c.id === formData.categoriaId) || null}
                                    onChange={(_, newValue) => setFormData({ ...formData, categoriaId: newValue ? newValue.id : null })}
                                    renderInput={(params) => <TextField {...params} label="Categoria (Opzionale)" fullWidth />}
                                />
                            </Grid>
                        </Grid>

                        <Grid container spacing={2}>
                            <Grid item xs={8}>
                                <TextField
                                    label="EAN / GTIN Prodotto (Opzionale)"
                                    fullWidth
                                    value={formData.ean}
                                    onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
                                    helperText="Inserisci il codice EAN solo se vuoi una regola specifica per un prodotto"
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    label="Priorità (0 = Max)"
                                    type="number"
                                    fullWidth
                                    value={formData.priorita}
                                    onChange={(e) => setFormData({ ...formData, priorita: parseInt(e.target.value) })}
                                />
                            </Grid>
                        </Grid>

                        <Grid container spacing={2}>
                            <Grid item xs={4}>
                                <TextField
                                    label="Markup %"
                                    type="number"
                                    fullWidth
                                    value={formData.markupPercentuale}
                                    onChange={(e) => setFormData({ ...formData, markupPercentuale: parseFloat(e.target.value) })}
                                    InputProps={{ endAdornment: '%' }}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    label="Markup Fisso €"
                                    type="number"
                                    fullWidth
                                    value={formData.markupFisso}
                                    onChange={(e) => setFormData({ ...formData, markupFisso: parseFloat(e.target.value) })}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    label="Spedizione €"
                                    type="number"
                                    fullWidth
                                    value={formData.costoSpedizione}
                                    onChange={(e) => setFormData({ ...formData, costoSpedizione: parseFloat(e.target.value) })}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Annulla</Button>
                    <Button onClick={handleSave} variant="contained">Salva</Button>
                </DialogActions>
            </Dialog>
            {/* Confirmation Dialog for Deletion */}
            <Dialog open={deleteConfirmationOpen} onClose={() => setDeleteConfirmationOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ color: 'error.main', fontWeight: 700 }}>Conferma Eliminazione</DialogTitle>
                <DialogContent>
                    <Typography variant="body1">
                        Sei sicuro di voler eliminare questa regola di pricing? Questa azione ricalcolerà immediatamente i prezzi di tutti i prodotti.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmationOpen(false)} color="inherit">
                        Annulla
                    </Button>
                    <Button
                        onClick={confirmDelete}
                        variant="contained"
                        color="error"
                        autoFocus
                    >
                        Elimina Regola
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}
