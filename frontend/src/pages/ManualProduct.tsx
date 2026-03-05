import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    Divider,
    CircularProgress,
    Card,
    CardMedia,
    CardContent,
    IconButton,
    InputAdornment,
    Alert,
    FormControlLabel,
    Checkbox,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Stack
} from '@mui/material';
import {
    Search as SearchIcon,
    CloudUpload as UploadIcon,
    Save as SaveIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Inventory as InventoryIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface IcecatFeature {
    name: string;
    value: string;
}

const ManualProduct: React.FC = () => {
    const [ean, setEan] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [productData, setProductData] = useState({
        nome: '',
        marca: '',
        categoria: '',
        descrizione: '',
        prezzo: 0,
        quantita: 1,
        specifiche: [] as IcecatFeature[],
        immagini: [] as string[]
    });

    const [pushImmediately, setPushImmediately] = useState(true);

    const handleFetchIcecat = async () => {
        if (!ean.trim()) {
            toast.error('Inserisci un EAN');
            return;
        }

        setLoading(true);
        try {
            const response = await api.get(`/icecat/fetch/${ean}`);
            const data = response.data.data;

            setProductData({
                ...productData,
                nome: data.descrizioneBrave || '',
                descrizione: data.descrizioneLunga || '',
                specifiche: JSON.parse(data.specificheTecnicheJson || '[]'),
                immagini: JSON.parse(data.urlImmaginiJson || '[]'),
                // Note: Icecat doesn't give price or brand easily in this response sometimes, 
                // but let's assume we can try to extract brand from specs or it might be in another field
            });
            toast.success('Dati recuperati da Icecat');
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Prodotto non trovato su Icecat');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!productData.nome || !ean) {
            toast.error('Nome e EAN sono obbligatori');
            return;
        }

        setSaving(true);
        try {
            const response = await api.post('/manual-product/create', {
                ean,
                ...productData,
                pushImmediately
            });

            if (response.data.success) {
                toast.success(pushImmediately
                    ? 'Prodotto creato e inviato a Shopify'
                    : 'Prodotto salvato correttamente');

                // Reset form
                setEan('');
                setProductData({
                    nome: '',
                    marca: '',
                    categoria: '',
                    descrizione: '',
                    prezzo: 0,
                    quantita: 1,
                    specifiche: [],
                    immagini: []
                });
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: '#1e293b' }}>
                Nuovo Prodotto Manuale (BTO)
            </Typography>

            <Grid container spacing={4}>
                {/* Search Sidebar */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Recupera Dati</Typography>
                        <TextField
                            fullWidth
                            label="Inserisci EAN"
                            value={ean}
                            onChange={(e) => setEan(e.target.value)}
                            variant="outlined"
                            sx={{ mb: 2 }}
                            onKeyPress={(e) => e.key === 'Enter' && handleFetchIcecat()}
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                            onClick={handleFetchIcecat}
                            disabled={loading || !ean}
                            sx={{ py: 1.5 }}
                        >
                            Cerca su Icecat
                        </Button>
                        <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
                            Inserisci l'EAN per pre-compilare la scheda con le informazioni ufficiali di Icecat.
                        </Alert>
                    </Paper>

                    {productData.immagini.length > 0 && (
                        <Paper sx={{ p: 3, mt: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>Immagini ({productData.immagini.length})</Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                {productData.immagini.map((img, idx) => (
                                    <Box
                                        key={idx}
                                        sx={{
                                            position: 'relative',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            aspectRatio: '1/1',
                                            border: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    )}
                </Grid>

                {/* Main Form */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                        <Typography variant="h6" sx={{ mb: 3 }}>Informazioni Base</Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Nome Prodotto"
                                    value={productData.nome}
                                    onChange={(e) => setProductData({ ...productData, nome: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Marca"
                                    value={productData.marca}
                                    onChange={(e) => setProductData({ ...productData, marca: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Categoria"
                                    value={productData.categoria}
                                    onChange={(e) => setProductData({ ...productData, categoria: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Prezzo di Vendita (€)"
                                    type="number"
                                    value={productData.prezzo}
                                    onChange={(e) => setProductData({ ...productData, prezzo: parseFloat(e.target.value) })}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">€</InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Quantità Iniziale"
                                    type="number"
                                    value={productData.quantita}
                                    onChange={(e) => setProductData({ ...productData, quantita: parseInt(e.target.value) })}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><InventoryIcon /></InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={6}
                                    label="Descrizione Lunga"
                                    value={productData.descrizione}
                                    onChange={(e) => setProductData({ ...productData, descrizione: e.target.value })}
                                />
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 4 }} />

                        <Typography variant="h6" sx={{ mb: 3 }}>Specifiche Tecniche</Typography>
                        <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Caratteristica</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Valore</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {productData.specifiche.length > 0 ? (
                                        productData.specifiche.map((spec, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{spec.name}</TableCell>
                                                <TableCell>{spec.value}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                Nessuna specifica caricata
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={pushImmediately}
                                        onChange={(e) => setPushImmediately(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Invia immediatamente a Shopify dopo il salvataggio"
                            />

                            <Stack direction="row" spacing={2}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    color="primary"
                                    size="large"
                                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                                    onClick={handleSave}
                                    disabled={saving || !productData.nome}
                                    sx={{ py: 2, borderRadius: 3, fontSize: '1.1rem' }}
                                >
                                    {pushImmediately ? 'Crea e Invia a Shopify' : 'Salva nel MasterFile'}
                                </Button>
                            </Stack>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ManualProduct;
