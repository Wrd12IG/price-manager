import { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    TextField,
    MenuItem,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Wifi as TestIcon,
    Visibility as PreviewIcon,
    CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';
import PreviewDialog from '../components/PreviewDialog';

interface Fornitore {
    id: number;
    nomeFornitore: string;
    urlListino?: string;
    formatoFile: string;
    tipoAccesso: string;
    username?: string;
    passwordEncrypted?: string;
    ftpHost?: string;
    ftpPort?: number;
    ftpDirectory?: string;
    encoding?: string;
    separatoreCSV?: string;
    attivo: boolean;
    ultimaSincronizzazione: string | null;
    _count?: {
        mappatureCampi: number;
        mappatureCategorie: number;
        listiniRaw: number;
    };
}

export default function Fornitori() {
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [selectedFornitoreId, setSelectedFornitoreId] = useState<number | null>(null);
    const [selectedFornitoreName, setSelectedFornitoreName] = useState('');
    const [editingFornitore, setEditingFornitore] = useState<Fornitore | null>(null);
    const [formData, setFormData] = useState({
        nomeFornitore: '',
        urlListino: '',
        formatoFile: 'CSV',
        tipoAccesso: 'direct_url',
        username: '',
        password: '',
        ftpHost: '',
        ftpPort: 21,
        ftpDirectory: '',
        encoding: 'UTF-8',
        separatoreCSV: ';',
    });

    // Confirmation States
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [importAllConfirmOpen, setImportAllConfirmOpen] = useState(false);

    useEffect(() => {
        fetchFornitori();
    }, []);

    const fetchFornitori = async () => {
        try {
            const response = await api.get('/fornitori');
            setFornitori(response.data?.data || []);
        } catch (error) {
            toast.error('Errore nel caricamento dei fornitori');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (fornitore?: Fornitore) => {
        if (fornitore) {
            setEditingFornitore(fornitore);
            setFormData({
                nomeFornitore: fornitore.nomeFornitore,
                urlListino: fornitore.urlListino || '',
                formatoFile: fornitore.formatoFile,
                tipoAccesso: fornitore.tipoAccesso,
                username: fornitore.username || '',
                password: '', // Password non viene restituita per sicurezza, lasciare vuoto per non modificare
                ftpHost: fornitore.ftpHost || '',
                ftpPort: fornitore.ftpPort || 21,
                ftpDirectory: fornitore.ftpDirectory || '',
                encoding: fornitore.encoding || 'UTF-8',
                separatoreCSV: fornitore.separatoreCSV || ';',
            });
        } else {
            setEditingFornitore(null);
            setFormData({
                nomeFornitore: '',
                urlListino: '',
                formatoFile: 'CSV',
                tipoAccesso: 'direct_url',
                username: '',
                password: '',
                ftpHost: '',
                ftpPort: 21,
                ftpDirectory: '',
                encoding: 'UTF-8',
                separatoreCSV: ';',
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingFornitore(null);
    };

    const handleSave = async () => {
        try {
            if (editingFornitore) {
                await api.put(`/fornitori/${editingFornitore.id}`, formData);
                toast.success('Fornitore aggiornato con successo');
            } else {
                await api.post('/fornitori', formData);
                toast.success('Fornitore creato con successo');
            }
            handleCloseDialog();
            fetchFornitori();
        } catch (error: any) {
            toast.error(error.response?.data?.error?.message || 'Errore nel salvataggio');
            console.error(error);
        }
    };

    const handleOpenDelete = (id: number) => {
        setDeleteId(id);
    };

    const executeDelete = async () => {
        if (!deleteId) return;
        setDeleteId(null);

        try {
            await api.delete(`/fornitori/${deleteId}`);
            toast.success('Fornitore eliminato');
            fetchFornitori();
        } catch (error) {
            toast.error('Errore nell\'eliminazione');
            console.error(error);
        }
    };

    const handleTestConnection = async (id: number) => {
        try {
            const response = await api.post(`/fornitori/${id}/test-connection`);
            if (response.data?.data?.success) {
                toast.success('Connessione riuscita!');
            } else {
                toast.error('Connessione fallita: ' + (response.data?.data?.error || 'Verifica i parametri'));
            }
        } catch (error) {
            toast.error('Errore nel test della connessione');
            console.error(error);
        }
    };

    const handlePreview = (fornitore: Fornitore) => {
        setSelectedFornitoreId(fornitore.id);
        setSelectedFornitoreName(fornitore.nomeFornitore);
        setPreviewOpen(true);
    };

    const handleImport = async (id: number) => {
        const toastId = toast.loading('Inizializzazione importazione...');
        let pollingInterval: any;

        try {
            // 1. Avvia la richiesta di importazione (che ora risponde subito)
            await api.post(`/fornitori/${id}/import`);

            // 2. Continua il polling finché lo stato non è 'success' o 'error'
            pollingInterval = setInterval(async () => {
                try {
                    const statusRes = await api.get(`/fornitori/${id}/import-status`);
                    const log = statusRes.data.data;

                    if (!log) return;

                    const current = log.prodottiProcessati || 0;

                    if (log.stato === 'running') {
                        toast.update(toastId, {
                            render: `Importazione in corso: ${current.toLocaleString()} prodotti elaborati...`,
                            type: 'default',
                            isLoading: true
                        });
                    } else if (log.stato === 'success') {
                        clearInterval(pollingInterval);
                        toast.update(toastId, {
                            render: `✅ Importazione completata! Inseriti: ${current.toLocaleString()} prodotti.`,
                            type: 'success',
                            isLoading: false,
                            autoClose: 10000
                        });
                        fetchFornitori();
                    } else if (log.stato === 'error') {
                        clearInterval(pollingInterval);
                        const errorMsg = log.dettagliJson ? JSON.parse(log.dettagliJson).error : 'Errore durante l\'elaborazione';
                        toast.update(toastId, {
                            render: `❌ Errore: ${errorMsg}`,
                            type: 'error',
                            isLoading: false,
                            autoClose: 10000
                        });
                        fetchFornitori();
                    }
                } catch (e) {
                    // Errore polling silenzioso
                }
            }, 3000);

        } catch (error: any) {
            if (pollingInterval) clearInterval(pollingInterval);
            const errorMessage = error.response?.data?.error?.message || 'Errore nell\'avvio importazione';
            toast.update(toastId, {
                render: errorMessage,
                type: 'error',
                isLoading: false,
                autoClose: 10000
            });
            fetchFornitori();
        }
    };

    const handleOpenImportAll = () => {
        setImportAllConfirmOpen(true);
    };

    const executeImportAll = async () => {
        setImportAllConfirmOpen(false);

        const toastId = toast.loading('Aggiornamento massivo in corso... attendere, non chiudere la pagina.');
        try {
            const response = await api.post('/fornitori/import-all');
            const responseData = response.data?.data || {};
            const results = responseData.results || [];
            const totalErrors = responseData.totalErrors || 0;

            // Formatta messaggio
            const safeResults = results || [];
            const successCount = safeResults.filter((r: any) => r.success).length;
            const failCount = safeResults.length - successCount;

            toast.update(toastId, {
                render: `Aggiornamento completato! Successi: ${successCount}, Falliti: ${failCount}.`,
                type: totalErrors > 0 ? 'warning' : 'success',
                isLoading: false,
                autoClose: 8000
            });
            fetchFornitori(); // Aggiorna ultima sync
        } catch (error: any) {
            toast.update(toastId, {
                render: error.response?.data?.error?.message || 'Errore durante l\'aggiornamento massivo',
                type: 'error',
                isLoading: false,
                autoClose: 8000
            });
            console.error(error);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Gestione Fornitori
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Configura i fornitori e le modalità di accesso ai listini
                    </Typography>
                </Box>
                <Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon sx={{ color: '#FFD700' }} />}
                        onClick={() => handleOpenDialog()}
                        sx={{ backgroundColor: '#000', '&:hover': { backgroundColor: '#333' } }}
                    >
                        Nuovo Fornitore
                    </Button>
                </Box>
            </Box>

            {/* Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Nome Fornitore</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Formato</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Tipo Accesso</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Stato</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Mappatura</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Ultima Sync</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Prodotti</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right">
                                Azioni
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(fornitori?.length || 0) === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Nessun fornitore configurato. Clicca su "Nuovo Fornitore" per iniziare.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            fornitori?.map((fornitore) => (
                                <TableRow key={fornitore.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {fornitore.nomeFornitore}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={fornitore.formatoFile} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{fornitore.tipoAccesso}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={fornitore.attivo ? 'Attivo' : 'Inattivo'}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                ...(fornitore.attivo && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff',
                                                    '& .MuiChip-label': { color: '#ffffff' }
                                                })
                                            }}
                                            color={fornitore.attivo ? 'default' : 'default'}
                                            variant={fornitore.attivo ? 'filled' : 'outlined'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={(fornitore._count?.mappatureCampi || 0) > 0 ? 'Mappato' : 'Da Mappare'}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                ...((fornitore._count?.mappatureCampi || 0) > 0 && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff',
                                                    '& .MuiChip-label': { color: '#ffffff' }
                                                })
                                            }}
                                            color={(fornitore._count?.mappatureCampi || 0) > 0 ? 'default' : 'warning'}
                                            variant={(fornitore._count?.mappatureCampi || 0) > 0 ? 'filled' : 'outlined'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {fornitore.ultimaSincronizzazione
                                            ? new Date(fornitore.ultimaSincronizzazione).toLocaleString('it-IT')
                                            : 'Mai'}
                                    </TableCell>
                                    <TableCell>{(fornitore._count?.listiniRaw ?? 0).toLocaleString()}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Testa connessione">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleTestConnection(fornitore.id)}
                                                color="info"
                                            >
                                                <TestIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Anteprima listino">
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                onClick={() => handlePreview(fornitore)}
                                            >
                                                <PreviewIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Importa listino ora">
                                            <IconButton
                                                size="small"
                                                color="success"
                                                onClick={() => handleImport(fornitore.id)}
                                            >
                                                <CloudDownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Modifica">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleOpenDialog(fornitore)}
                                                color="primary"
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Elimina">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleOpenDelete(fornitore.id)}
                                                color="error"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingFornitore ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Nome Fornitore"
                            value={formData.nomeFornitore}
                            onChange={(e) => setFormData({ ...formData, nomeFornitore: e.target.value })}
                            fullWidth
                            required
                        />
                        <TextField
                            label="URL Listino"
                            value={formData.urlListino}
                            onChange={(e) => setFormData({ ...formData, urlListino: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            select
                            label="Formato File"
                            value={formData.formatoFile}
                            onChange={(e) => setFormData({ ...formData, formatoFile: e.target.value })}
                            fullWidth
                        >
                            <MenuItem value="CSV">CSV</MenuItem>
                            <MenuItem value="TXT">TXT</MenuItem>
                            <MenuItem value="Excel">Excel</MenuItem>
                            <MenuItem value="XML">XML</MenuItem>
                            <MenuItem value="JSON">JSON</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label="Tipo Accesso"
                            value={formData.tipoAccesso}
                            onChange={(e) => setFormData({ ...formData, tipoAccesso: e.target.value })}
                            fullWidth
                        >
                            <MenuItem value="direct_url">Download Diretto URL</MenuItem>
                            <MenuItem value="http_auth">HTTP con Credenziali</MenuItem>
                            <MenuItem value="ftp">FTP/SFTP</MenuItem>
                            <MenuItem value="api">API REST</MenuItem>
                        </TextField>
                        {(formData.tipoAccesso === 'http_auth' || formData.tipoAccesso === 'ftp') && (
                            <>
                                <TextField
                                    label="Username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    fullWidth
                                />
                                <TextField
                                    label="Password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    fullWidth
                                />
                            </>
                        )}
                        {formData.tipoAccesso === 'ftp' && (
                            <>
                                <TextField
                                    label="Host FTP"
                                    value={formData.ftpHost}
                                    onChange={(e) => setFormData({ ...formData, ftpHost: e.target.value })}
                                    fullWidth
                                    placeholder="ftp.example.com"
                                    helperText="Indirizzo del server FTP/SFTP"
                                />
                                <TextField
                                    label="Porta"
                                    type="number"
                                    value={formData.ftpPort}
                                    onChange={(e) => setFormData({ ...formData, ftpPort: parseInt(e.target.value) || 21 })}
                                    fullWidth
                                    helperText="Porta FTP (default: 21) o SFTP (default: 22)"
                                />
                                <TextField
                                    label="Directory FTP"
                                    value={formData.ftpDirectory}
                                    onChange={(e) => setFormData({ ...formData, ftpDirectory: e.target.value })}
                                    fullWidth
                                    placeholder="/listini"
                                    helperText="Cartella contenente i file da scaricare (scarica tutti i file)"
                                />
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Annulla</Button>
                    <Button onClick={handleSave} variant="contained">
                        Salva
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                aria-labelledby="delete-dialog-title"
            >
                <DialogTitle id="delete-dialog-title">Elimina Fornitore</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Sei sicuro di voler eliminare questo fornitore?
                        L'operazione è irreversibile e potrebbe eliminare prodotti associati.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteId(null)} color="inherit">
                        Annulla
                    </Button>
                    <Button onClick={executeDelete} color="error" variant="contained" autoFocus>
                        Elimina
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Mass Import Confirmation Dialog */}
            <Dialog
                open={importAllConfirmOpen}
                onClose={() => setImportAllConfirmOpen(false)}
                aria-labelledby="import-all-dialog-title"
            >
                <DialogTitle id="import-all-dialog-title">Avvio Aggiornamento Massivo</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Stai per avviare l'aggiornamento di TUTTI i listini attivi.
                        Questa operazione potrebbe richiedere alcuni minuti.
                        Vuoi procedere?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImportAllConfirmOpen(false)} color="inherit">
                        Annulla
                    </Button>
                    <Button onClick={executeImportAll} variant="contained" autoFocus>
                        Conferma e Avvia
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Preview Dialog */}
            <PreviewDialog
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                fornitoreId={selectedFornitoreId}
                nomeFornitore={selectedFornitoreName}
            />
        </Box>
    );
}
