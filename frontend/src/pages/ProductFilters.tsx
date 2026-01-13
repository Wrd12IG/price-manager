import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Autocomplete,
    TextField,
    Button,
    Typography,
    Box,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    Chip,
    IconButton,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    Add as AddIcon,
    Science as ScienceIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Inventory as InventoryIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import './ProductFilters.css';

const API_BASE_URL = 'http://localhost:3000/api';

interface FilterRule {
    id: number;
    nome: string;
    marchioId: number | null;
    categoriaId: number | null;
    azione: string;
    priorita: number;
    attiva: boolean;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    marchio?: { nome: string };
    categoria?: { nome: string };
    matchedCount?: number;
}

interface FilterPreset {
    id: number;
    nome: string;
    descrizione: string | null;
    regoleJson: string;
    attivo: boolean;
}

interface TestResult {
    shouldInclude: boolean;
    matchedRule?: string;
    reason?: string;
}

export default function ProductFilters() {
    const [rules, setRules] = useState<FilterRule[]>([]);
    const [presets, setPresets] = useState<FilterPreset[]>([]);
    const [activePreset, setActivePreset] = useState<FilterPreset | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTestModal, setShowTestModal] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    // Opzioni per Autocomplete
    const [marche, setMarche] = useState<any[]>([]);
    const [categorie, setCategorie] = useState<any[]>([]);

    // Form state per nuova regola
    const [newRule, setNewRule] = useState({
        nome: '',
        marchioId: null as number | null,
        categoriaId: null as number | null,
        azione: 'include',
        priorita: 1,
        attiva: true,
        note: ''
    });

    const [editingRuleId, setEditingRuleId] = useState<number | null>(null);

    // Form state per test
    const [testData, setTestData] = useState({
        brand: '',
        category: ''
    });

    useEffect(() => {
        loadData();
        fetchOptions();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rulesRes, presetsRes, activePresetRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/filters/rules`),
                axios.get(`${API_BASE_URL}/filters/presets`),
                axios.get(`${API_BASE_URL}/filters/presets/active`)
            ]);

            setRules(rulesRes.data.data || []);
            setPresets(presetsRes.data.data || []);
            setActivePreset(activePresetRes.data.data);
        } catch (error) {
            console.error('Errore nel caricamento dei dati:', error);
            toast.error('Errore nel caricamento dati');
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [marcheRes, categorieRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/marchi?limit=2000`),
                axios.get(`${API_BASE_URL}/categorie?limit=2000`)
            ]);
            setMarche(marcheRes.data.data);
            setCategorie(categorieRes.data.data);
        } catch (error) {
            console.error('Errore caricamento opzioni:', error);
        }
    };

    const handleCreateOrUpdateRule = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Prepara i dati assicurandosi che siano nel formato corretto
        const ruleData = {
            nome: newRule.nome?.trim() || '',
            marchioId: newRule.marchioId || null,
            categoriaId: newRule.categoriaId || null,
            azione: newRule.azione || 'include',
            priorita: typeof newRule.priorita === 'number' ? newRule.priorita : 1,
            attiva: newRule.attiva !== undefined ? newRule.attiva : true,
            note: newRule.note?.trim() || null
        };

        // Validazione lato client
        if (!ruleData.nome) {
            toast.error('Il nome della regola è obbligatorio');
            return;
        }

        console.log('Invio dati regola:', ruleData);

        try {
            if (editingRuleId) {
                console.log(`PUT /filters/rules/${editingRuleId}`, ruleData);
                await axios.put(`${API_BASE_URL}/filters/rules/${editingRuleId}`, ruleData);
                toast.success('Regola aggiornata. Esegui "Consolidamento" per applicare!');
            } else {
                console.log('POST /filters/rules', ruleData);
                await axios.post(`${API_BASE_URL}/filters/rules`, ruleData);
                toast.success('Regola creata. Esegui "Consolidamento" per applicare!');
            }
            setShowAddModal(false);
            setEditingRuleId(null);
            setNewRule({
                nome: '',
                marchioId: null,
                categoriaId: null,
                azione: 'include',
                priorita: 1,
                attiva: true,
                note: ''
            });
            loadData();
        } catch (error: any) {
            console.error('Errore nel salvataggio della regola:', error);
            console.error('Response data:', error.response?.data);
            console.error('Response status:', error.response?.status);

            // Mostra messaggio di errore dettagliato
            const errorMessage = error.response?.data?.error ||
                error.response?.data?.message ||
                error.message ||
                'Errore nel salvataggio';
            toast.error(`Errore: ${errorMessage}`);
        }
    };

    const handleEditRule = (rule: FilterRule) => {
        setEditingRuleId(rule.id);
        setNewRule({
            nome: rule.nome,
            marchioId: rule.marchioId,
            categoriaId: rule.categoriaId,
            azione: rule.azione,
            priorita: rule.priorita,
            attiva: rule.attiva,
            note: rule.note || ''
        });
        setShowAddModal(true);
    };

    const handleToggleRule = async (id: number, attiva: boolean) => {
        try {
            await axios.patch(`${API_BASE_URL}/filters/rules/${id}/toggle`, { attiva });
            toast.success('Stato regola aggiornato. Esegui "Consolidamento" per applicare!');
            loadData();
        } catch (error) {
            console.error('Errore nel toggle della regola:', error);
            toast.error('Impossibile cambiare stato regola');
        }
    };

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

    const handleOpenDeleteDialog = (id: number) => {
        setRuleToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setRuleToDelete(null);
    };

    const executeDeleteRule = async () => {
        if (!ruleToDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/filters/rules/${ruleToDelete}`);
            toast.success('Regola eliminata. Esegui "Consolidamento" per applicare!');
            loadData();
            handleCloseDeleteDialog();
        } catch (error) {
            console.error('Errore nell\'eliminazione della regola:', error);
            toast.error('Errore eliminazione');
        }
    };

    const handleActivatePreset = async (id: number) => {
        try {
            await axios.post(`${API_BASE_URL}/filters/presets/${id}/activate`);
            toast.success('Preset attivato');
            loadData();
        } catch (error) {
            console.error('Errore nell\'attivazione del preset:', error);
            toast.error('Errore attivazione preset');
        }
    };

    const handleTestFilter = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        try {
            const response = await axios.post(`${API_BASE_URL}/filters/test`, testData);
            setTestResult(response.data.data);
        } catch (error) {
            console.error('Errore nel test del filtro:', error);
            toast.error('Errore durante il test');
        }
    };

    const getAzioneLabel = (azione: string) => {
        return azione === 'include' ? 'Includi' : 'Escludi';
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <Typography>Caricamento...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    Filtri Prodotti
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Gestisci quali prodotti includere/escludere dai listini fornitori
                </Typography>
            </Box>

            {/* Preset Section */}
            <Box className="section presets-section" sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Preset Configurazioni</Typography>
                <Grid container spacing={2}>
                    {presets.map(preset => (
                        <Grid item xs={12} sm={6} md={4} key={preset.id}>
                            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderColor: preset.attivo ? 'primary.main' : 'divider' }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="h6" component="h3">{preset.nome}</Typography>
                                        {preset.attivo && <Chip label="Attivo" color="primary" size="small" />}
                                    </Box>
                                    {preset.descrizione && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{preset.descrizione}</Typography>
                                    )}
                                </CardContent>
                                <CardActions sx={{ p: 2, pt: 0 }}>
                                    {!preset.attivo && (
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => handleActivatePreset(preset.id)}
                                            fullWidth
                                        >
                                            Attiva Preset
                                        </Button>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* Actions Bar */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon sx={{ color: '#FFD700' }} />}
                        onClick={() => {
                            setEditingRuleId(null);
                            setNewRule({
                                nome: '',
                                marchioId: null,
                                categoriaId: null,
                                azione: 'include',
                                priorita: 1,
                                attiva: true,
                                note: ''
                            });
                            setShowAddModal(true);
                        }}
                    // Style already globally applied, but ensuring specificity if needed
                    >
                        Aggiungi Regola
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ScienceIcon />}
                        onClick={() => setShowTestModal(true)}
                        sx={{ color: 'text.primary', borderColor: 'divider' }}
                    >
                        Testa Filtro
                    </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                    <Typography variant="body2">
                        <strong>{rules.length}</strong> regole totali
                    </Typography>
                    <Typography variant="body2">
                        <strong>{rules.filter(r => r.attiva).length}</strong> attive
                    </Typography>
                </Box>
            </Paper>

            {/* Rules Table Grouped */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckIcon color="success" /> Regole di Inclusione
                </Typography>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                <TableCell>Priorità</TableCell>
                                <TableCell>Nome</TableCell>
                                <TableCell>Brand</TableCell>
                                <TableCell>Categoria</TableCell>
                                <TableCell>Prodotti (Raw)</TableCell>
                                <TableCell>Azione</TableCell>
                                <TableCell>Stato</TableCell>
                                <TableCell>Note</TableCell>
                                <TableCell align="right">Azioni</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rules.filter(r => r.azione === 'include').map(rule => (
                                <TableRow key={rule.id} hover sx={{ opacity: rule.attiva ? 1 : 0.6 }}>
                                    <TableCell>
                                        <Typography fontWeight="bold">{rule.priorita}</Typography>
                                    </TableCell>
                                    <TableCell>{rule.nome.toUpperCase()}</TableCell>
                                    <TableCell>{rule.marchio?.nome?.toUpperCase() || <Typography variant="caption" color="text.secondary">TUTTI</Typography>}</TableCell>
                                    <TableCell>{rule.categoria?.nome?.toUpperCase() || <Typography variant="caption" color="text.secondary">TUTTE</Typography>}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={rule.matchedCount || 0}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                ...((rule.matchedCount || 0) > 0 && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff'
                                                })
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={getAzioneLabel(rule.azione)} color="success" size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={rule.attiva}
                                            onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{rule.note || '-'}</TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleEditRule(rule)} color="primary">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleOpenDeleteDialog(rule.id)} color="error">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {rules.filter(r => r.azione === 'include').length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} align="center">Nessuna regola di inclusione.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloseIcon color="error" /> Regole di Esclusione
                </Typography>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                                <TableCell>Priorità</TableCell>
                                <TableCell>Nome</TableCell>
                                <TableCell>Brand</TableCell>
                                <TableCell>Categoria</TableCell>
                                <TableCell>Prodotti (Raw)</TableCell>
                                <TableCell>Azione</TableCell>
                                <TableCell>Stato</TableCell>
                                <TableCell>Note</TableCell>
                                <TableCell align="right">Azioni</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rules.filter(r => r.azione === 'exclude').map(rule => (
                                <TableRow key={rule.id} hover sx={{ opacity: rule.attiva ? 1 : 0.6 }}>
                                    <TableCell>
                                        <Typography fontWeight="bold">{rule.priorita}</Typography>
                                    </TableCell>
                                    <TableCell>{rule.nome.toUpperCase()}</TableCell>
                                    <TableCell>{rule.marchio?.nome?.toUpperCase() || <Typography variant="caption" color="text.secondary">TUTTI</Typography>}</TableCell>
                                    <TableCell>{rule.categoria?.nome?.toUpperCase() || <Typography variant="caption" color="text.secondary">TUTTE</Typography>}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={rule.matchedCount || 0}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                ...((rule.matchedCount || 0) > 0 && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff'
                                                })
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={getAzioneLabel(rule.azione)} color="error" size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={rule.attiva}
                                            onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{rule.note || '-'}</TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleEditRule(rule)} color="primary">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleOpenDeleteDialog(rule.id)} color="error">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {rules.filter(r => r.azione === 'exclude').length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} align="center">Nessuna regola di esclusione.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Conferma Eliminazione"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Sei sicuro di voler eliminare questa regola? L'operazione non può essere annullata.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog} color="inherit">
                        Annulla
                    </Button>
                    <Button onClick={executeDeleteRule} color="error" variant="contained" autoFocus>
                        Elimina
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add/Edit Rule Dialog */}
            <Dialog open={showAddModal} onClose={() => setShowAddModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingRuleId ? 'Modifica Regola' : 'Aggiungi Nuova Regola'}</DialogTitle>
                <DialogContent>
                    <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Nome Regola"
                            value={newRule.nome}
                            onChange={(e) => setNewRule({ ...newRule, nome: e.target.value })}
                            required
                            fullWidth
                            placeholder="es. Tutti i prodotti ASUS"
                        />
                        <Autocomplete
                            options={marche}
                            getOptionLabel={(option) => option.nome}
                            value={marche.find(m => m.id === newRule.marchioId) || null}
                            onChange={(_, newValue) => setNewRule({ ...newRule, marchioId: newValue ? newValue.id : null })}
                            renderInput={(params) => <TextField {...params} label="Brand (Opzionale)" />}
                        />
                        <Autocomplete
                            options={categorie}
                            getOptionLabel={(option) => option.nome}
                            value={categorie.find(c => c.id === newRule.categoriaId) || null}
                            onChange={(_, newValue) => setNewRule({ ...newRule, categoriaId: newValue ? newValue.id : null })}
                            renderInput={(params) => <TextField {...params} label="Categoria (Opzionale)" />}
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Azione</InputLabel>
                                    <Select
                                        value={newRule.azione}
                                        label="Azione"
                                        onChange={(e) => setNewRule({ ...newRule, azione: e.target.value })}
                                    >
                                        <MenuItem value="include">Includi</MenuItem>
                                        <MenuItem value="exclude">Escludi</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    label="Priorità"
                                    type="number"
                                    value={newRule.priorita}
                                    onChange={(e) => setNewRule({ ...newRule, priorita: parseInt(e.target.value) })}
                                    fullWidth
                                    inputProps={{ min: 1, max: 10 }}
                                />
                            </Grid>
                        </Grid>
                        <TextField
                            label="Note"
                            value={newRule.note}
                            onChange={(e) => setNewRule({ ...newRule, note: e.target.value })}
                            multiline
                            rows={3}
                            fullWidth
                            placeholder="Note opzionali..."
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={newRule.attiva}
                                    onChange={(e) => setNewRule({ ...newRule, attiva: e.target.checked })}
                                />
                            }
                            label="Regola Attiva"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAddModal(false)}>Annulla</Button>
                    <Button
                        onClick={() => handleCreateOrUpdateRule()}
                        variant="contained"
                    // Theme auto-applies black bg/yellow icon
                    >
                        {editingRuleId ? 'Salva Modifiche' : 'Crea Regola'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Test Filter Dialog */}
            <Dialog open={showTestModal} onClose={() => setShowTestModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Testa Filtro Prodotto</DialogTitle>
                <DialogContent>
                    <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Brand"
                            value={testData.brand}
                            onChange={(e) => setTestData({ ...testData, brand: e.target.value })}
                            fullWidth
                            placeholder="es. ASUS"
                        />
                        <TextField
                            label="Categoria"
                            value={testData.category}
                            onChange={(e) => setTestData({ ...testData, category: e.target.value })}
                            fullWidth
                            placeholder="es. Monitor"
                        />
                        {testResult && (
                            <Paper sx={{ p: 2, bgcolor: testResult.shouldInclude ? 'success.light' : 'error.light', color: '#fff' }}>
                                <Typography variant="h6" fontWeight="bold">
                                    {testResult.shouldInclude ? 'Prodotto INCLUSO' : 'Prodotto ESCLUSO'}
                                </Typography>
                                {testResult.matchedRule && (
                                    <Typography variant="body2"><strong>Regola:</strong> {testResult.matchedRule}</Typography>
                                )}
                                {testResult.reason && (
                                    <Typography variant="body2"><strong>Motivo:</strong> {testResult.reason}</Typography>
                                )}
                            </Paper>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowTestModal(false)}>Chiudi</Button>
                    <Button
                        onClick={(e) => handleTestFilter(e)}
                        variant="contained"
                    >
                        Testa
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
