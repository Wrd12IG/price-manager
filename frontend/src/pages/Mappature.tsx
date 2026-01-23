import { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    SelectChangeEvent
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Fornitore {
    id: number;
    nomeFornitore: string;
}

interface CampoStandard {
    key: string;
    label: string;
    required: boolean;
}

export default function Mappature() {
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [selectedFornitoreId, setSelectedFornitoreId] = useState<string>('');

    const [campiStandard, setCampiStandard] = useState<CampoStandard[]>([]);
    const [colonneFile, setColonneFile] = useState<string[]>([]);
    const [mappatura, setMappatura] = useState<Record<string, string>>({});

    const [loading, setLoading] = useState(false);
    const [loadingDati, setLoadingDati] = useState(false);

    // Carica lista fornitori e campi standard all'avvio
    useEffect(() => {
        const init = async () => {
            try {
                const [resFornitori, resCampi] = await Promise.all([
                    axios.get('/api/fornitori'),
                    axios.get('/api/mappature/campi/standard')
                ]);
                setFornitori(resFornitori.data?.data || []);
                setCampiStandard(resCampi.data?.data || []);
            } catch (error) {
                console.error(error);
                toast.error('Errore inizializzazione dati');
            }
        };
        init();
    }, []);

    // Quando cambia fornitore, carica colonne file e mappatura esistente
    useEffect(() => {
        if (!selectedFornitoreId) {
            setColonneFile([]);
            setMappatura({});
            return;
        }

        const loadFornitoreData = async () => {
            setLoadingDati(true);
            try {
                // 1. Carica colonne dal file (usando preview)
                const resPreview = await axios.get(`/api/fornitori/${selectedFornitoreId}/preview?rows=1`);
                setColonneFile(resPreview.data.data.headers || []);

                // 2. Carica mappatura salvata
                const resMappatura = await axios.get(`/api/mappature/campi/${selectedFornitoreId}`);
                setMappatura(resMappatura.data.data || {});

            } catch (error) {
                console.error(error);
                toast.error('Errore caricamento dati fornitore. Verifica che il file sia accessibile.');
                setColonneFile([]);
            } finally {
                setLoadingDati(false);
            }
        };

        loadFornitoreData();
    }, [selectedFornitoreId]);

    const handleMappaturaChange = (campoSistema: string, colonnaFile: string) => {
        setMappatura(prev => ({
            ...prev,
            [campoSistema]: colonnaFile
        }));
    };

    const handleSave = async () => {
        if (!selectedFornitoreId) return;

        setLoading(true);
        try {
            await axios.post(`/api/mappature/campi/${selectedFornitoreId}`, mappatura);
            toast.success('Mappatura salvata con successo!');
        } catch (error) {
            console.error(error);
            toast.error('Errore durante il salvataggio');
        } finally {
            setLoading(false);
        }
    };

    // Funzione per auto-mappare (euristica semplice)
    const autoMap = () => {
        const newMap = { ...mappatura };
        campiStandard.forEach(campo => {
            if (!newMap[campo.key]) {
                // Cerca una colonna che contenga il nome del campo (case insensitive)
                const match = colonneFile.find(col =>
                    col.toLowerCase().includes(campo.key.toLowerCase()) ||
                    col.toLowerCase().includes(campo.label.split(' ')[0].toLowerCase())
                );
                if (match) {
                    newMap[campo.key] = match;
                }
            }
        });
        setMappatura(newMap);
        toast.info('Auto-mappatura applicata');
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
                Mappatura Campi
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Associa le colonne del file del fornitore ai campi del sistema.
            </Typography>

            <Paper sx={{ p: 3, mb: 4 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                            <InputLabel>Seleziona Fornitore</InputLabel>
                            <Select
                                value={selectedFornitoreId}
                                label="Seleziona Fornitore"
                                onChange={(e: SelectChangeEvent) => setSelectedFornitoreId(e.target.value)}
                            >
                                <MenuItem value=""><em>Nessuno</em></MenuItem>
                                {fornitori.map(f => (
                                    <MenuItem key={f.id} value={f.id.toString()}>{f.nomeFornitore}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        {selectedFornitoreId && (
                            <Button variant="outlined" onClick={autoMap} disabled={loadingDati || colonneFile.length === 0}>
                                Auto-Mappa Campi
                            </Button>
                        )}
                    </Grid>
                </Grid>
            </Paper>

            {selectedFornitoreId && (
                <>
                    {/* Riepilogo Mappature Salvate */}
                    {Object.keys(mappatura).length > 0 && (
                        <Paper sx={{ p: 3, mb: 4, bgcolor: '#f5f5f5', border: '1px solid #e0e0e0' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SaveIcon fontSize="small" sx={{ color: '#FFD700' }} /> Mappature Attive
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Queste impostazioni sono salvate nel database
                                </Typography>
                            </Box>
                            <Grid container spacing={2}>
                                {campiStandard.filter(c => mappatura[c.key]).map((campo) => (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={campo.key}>
                                        <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                                                {campo.label}
                                            </Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                {mappatura[campo.key]}
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Paper>
                    )}

                    {loadingDati ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            {colonneFile.length === 0 && (
                                <Alert severity="warning" sx={{ mb: 3 }}>
                                    Attenzione: Impossibile recuperare le colonne dal file del fornitore.
                                    Puoi comunque visualizzare le mappature salvate sopra, ma per modificarle è necessario che il file sia accessibile.
                                </Alert>
                            )}

                            {colonneFile.length > 0 && (
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                                <TableCell sx={{ fontWeight: 600, width: '40%' }}>Campo Sistema</TableCell>
                                                <TableCell sx={{ fontWeight: 600, width: '60%' }}>Colonna File Fornitore</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {campiStandard.map((campo) => (
                                                <TableRow key={campo.key} hover selected={!!mappatura[campo.key]}>
                                                    <TableCell>
                                                        <Box>
                                                            <Typography variant="subtitle2">
                                                                {campo.label} {campo.required && <span style={{ color: 'red' }}>*</span>}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {campo.key}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormControl fullWidth size="small">
                                                            <Select
                                                                value={mappatura[campo.key] || ''}
                                                                onChange={(e) => handleMappaturaChange(campo.key, e.target.value)}
                                                                displayEmpty
                                                            >
                                                                <MenuItem value="">
                                                                    <em>Non mappato</em>
                                                                </MenuItem>
                                                                {/* Opzione salvata (anche se non presente nel file attuale) */}
                                                                {mappatura[campo.key] && !colonneFile.includes(mappatura[campo.key]) && (
                                                                    <MenuItem value={mappatura[campo.key]}>
                                                                        {mappatura[campo.key]} (Salvato - Non trovato nel file)
                                                                    </MenuItem>
                                                                )}
                                                                {colonneFile.map((col) => (
                                                                    <MenuItem key={col} value={col}>
                                                                        {col}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            variant="contained"
                                            startIcon={<SaveIcon sx={{ color: '#FFD700' }} />}
                                            onClick={handleSave}
                                            disabled={loading}
                                        >
                                            Salva Mappatura
                                        </Button>
                                    </Box>
                                </TableContainer>
                            )}
                        </>
                    )}
                </>
            )}
        </Box>
    );
}
