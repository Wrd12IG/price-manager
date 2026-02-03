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
    SelectChangeEvent,
    Autocomplete,
    TextField
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import api from '../utils/api';
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
    console.log('🚀 Mappature Component Loaded - v1.4.1 (Fixed Imports & FreeSolo)');

    // State Definitions
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [selectedFornitoreId, setSelectedFornitoreId] = useState<string>('');
    const [campiStandard, setCampiStandard] = useState<CampoStandard[]>([]);
    const [colonneFile, setColonneFile] = useState<string[]>([]);
    const [mappatura, setMappatura] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [loadingDati, setLoadingDati] = useState(false);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            try {
                const [resFornitori, resCampi] = await Promise.all([
                    api.get('/fornitori'),
                    api.get('/mappature/campi/standard')
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

    // Fetch Supplier Data
    const fetchDatiFornitore = async (id: string) => {
        setLoadingDati(true);
        try {
            // 1. Load file columns (Preview)
            try {
                const resPreview = await api.get(`/fornitori/${id}/preview?rows=1`);
                const headers = resPreview.data?.data?.headers || [];
                setColonneFile(headers);
            } catch (previewErr) {
                console.warn("Preview failed (offline file?)", previewErr);
                setColonneFile([]);
            }

            // 2. Load saved mapping
            try {
                const resMappatura = await api.get(`/mappature/campi/${id}`);
                setMappatura(resMappatura.data?.data || {});
            } catch (mapErr: any) {
                if (mapErr.response && mapErr.response.status === 404) {
                    setMappatura({});
                } else {
                    throw mapErr;
                }
            }

        } catch (error) {
            console.error(error);
            toast.error('Errore generico caricamento dati.');
        } finally {
            setLoadingDati(false);
        }
    };

    // Trigger Fetch on Supplier Change
    useEffect(() => {
        if (!selectedFornitoreId) {
            setColonneFile([]);
            setMappatura({});
            return;
        }
        fetchDatiFornitore(selectedFornitoreId);
    }, [selectedFornitoreId]);

    // Handlers
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
            await api.post(`/mappature/campi/${selectedFornitoreId}`, mappatura);
            toast.success('Mappatura salvata con successo!');
        } catch (error) {
            console.error(error);
            toast.error('Errore durante il salvataggio');
        } finally {
            setLoading(false);
        }
    };

    const autoMap = () => {
        const newMap = { ...mappatura };
        (campiStandard || []).forEach(campo => {
            if (!newMap[campo.key]) {
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

    const resetCache = () => {
        setMappatura({});
        setColonneFile([]);
        if (selectedFornitoreId) {
            fetchDatiFornitore(selectedFornitoreId);
        }
        toast.info('Cache resettata e dati ricaricati.');
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
                Mappatura Campi
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Associa le colonne del file del fornitore ai campi del sistema.
                {colonneFile.length === 0 && selectedFornitoreId && (
                    <span style={{ color: 'orange', display: 'block', marginTop: '8px' }}>
                        ⚠️ File offline o non leggibile. Puoi comunque digitare manualmente i nomi delle colonne.
                    </span>
                )}
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
                                {fornitori?.map(f => (
                                    <MenuItem key={f.id} value={f.id.toString()}>{f.nomeFornitore}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        {selectedFornitoreId && (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button variant="outlined" color="warning" onClick={resetCache} disabled={loadingDati}>
                                    Reset & Ricarica
                                </Button>
                                <Button variant="outlined" onClick={autoMap} disabled={loadingDati || (colonneFile?.length || 0) === 0}>
                                    Auto-Mappa Campi
                                </Button>
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </Paper>

            {selectedFornitoreId && (
                <>
                    {loadingDati && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {!loadingDati && (
                        <>
                            {campiStandard.length === 0 && (
                                <Alert severity="error" sx={{ mb: 3 }}>
                                    Errore critico: Impossibile caricare la lista dei campi standard dal sistema. Ricarica la pagina.
                                </Alert>
                            )}

                            {/* TableContainer is always rendered to avoid "empty page" perception */}
                            <TableContainer component={Paper}>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                            <TableCell sx={{ fontWeight: 600, width: '40%' }}>Campo Sistema</TableCell>
                                            <TableCell sx={{ fontWeight: 600, width: '60%' }}>
                                                Colonna File (Seleziona o Scrivi)
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {campiStandard?.map((campo) => (
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
                                                    <Autocomplete
                                                        freeSolo
                                                        options={colonneFile}
                                                        value={mappatura[campo.key] || ''}
                                                        onInputChange={(_, newInputValue) => {
                                                            handleMappaturaChange(campo.key, newInputValue);
                                                        }}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                placeholder={colonneFile.length === 0 ? "Digita nome colonna..." : "Seleziona..."}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                    />
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
                        </>
                    )}
                </>
            )}
        </Box>
    );
}
