import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    TextField,
    Typography,
    Chip,
    Switch,
    FormControlLabel,
    Alert,
    CircularProgress,
    InputAdornment
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { toast } from 'react-toastify';

interface Marchio {
    id: number;
    nome: string;
    normalizzato: string;
    attivo: boolean;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    _count: {
        masterFiles: number;
        regoleMarkup: number;
        filtri: number;
    };
}

const Marchi: React.FC = () => {
    const [marchi, setMarchi] = useState<Marchio[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingMarchio, setEditingMarchio] = useState<Marchio | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        attivo: true,
        note: ''
    });

    // Delete Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [marchioToDelete, setMarchioToDelete] = useState<Marchio | null>(null);

    useEffect(() => {
        fetchMarchi();
    }, [showActiveOnly]);

    const fetchMarchi = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (showActiveOnly) params.attivo = 'true';

            const response = await api.get('/marchi', { params });
            setMarchi(response.data?.data || []);
        } catch (error: any) {
            toast.error('Errore nel caricamento dei marchi');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (marchio?: Marchio) => {
        if (marchio) {
            setEditingMarchio(marchio);
            setFormData({
                nome: marchio.nome,
                attivo: marchio.attivo,
                note: marchio.note || ''
            });
        } else {
            setEditingMarchio(null);
            setFormData({
                nome: '',
                attivo: true,
                note: ''
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingMarchio(null);
    };

    const handleSave = async () => {
        if (!formData.nome.trim()) {
            toast.error('Il nome del marchio è obbligatorio');
            return;
        }

        try {
            if (editingMarchio) {
                // Update
                await api.put(`/marchi/${editingMarchio.id}`, formData);
                toast.success('Marchio aggiornato con successo');
            } else {
                // Create
                await api.post('/marchi', formData);
                toast.success('Marchio creato con successo');
            }

            handleCloseDialog();
            fetchMarchi();
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Errore nel salvataggio';
            toast.error(message);
        }
    };

    const handleDelete = (marchio: Marchio) => {
        const totalUsage = marchio._count.masterFiles + marchio._count.regoleMarkup + marchio._count.filtri;

        if (totalUsage > 0) {
            toast.warning(
                `Impossibile eliminare. Il marchio è utilizzato in ${totalUsage} record (${marchio._count.masterFiles} prodotti, ${marchio._count.regoleMarkup} regole pricing, ${marchio._count.filtri} filtri)`
            );
            return;
        }

        setMarchioToDelete(marchio);
        setDeleteDialogOpen(true);
    };

    const executeDelete = async () => {
        if (!marchioToDelete) return;
        setDeleteDialogOpen(false);

        try {
            await api.delete(`/marchi/${marchioToDelete.id}`);
            toast.success('Marchio eliminato con successo');
            fetchMarchi();
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Errore nell\'eliminazione';
            toast.error(message);
        } finally {
            setMarchioToDelete(null);
        }
    };

    const filteredMarchi = marchi.filter(m =>
        m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.normalizzato.includes(searchTerm.toUpperCase())
    );

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Gestione Marchi</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Nuovo Marchio
                </Button>
            </Box>

            <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder="Cerca marchio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        size="small"
                        sx={{ flexGrow: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showActiveOnly}
                                onChange={(e) => setShowActiveOnly(e.target.checked)}
                            />
                        }
                        label="Solo Attivi"
                    />
                </Box>

                <Alert severity="info" sx={{ mt: 2 }}>
                    Totale marchi: {(filteredMarchi?.length || 0)} {showActiveOnly && '(solo attivi)'}
                </Alert>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Nome</TableCell>
                                <TableCell>Stato</TableCell>
                                <TableCell>Prodotti</TableCell>
                                <TableCell>Regole Pricing</TableCell>
                                <TableCell>Filtri</TableCell>
                                <TableCell>Note</TableCell>
                                <TableCell align="right">Azioni</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredMarchi?.map((marchio) => (
                                <TableRow key={marchio.id} hover>
                                    <TableCell>{marchio.id}</TableCell>
                                    <TableCell>
                                        <Typography variant="body1" fontWeight="500">
                                            {marchio.nome}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {marchio.normalizzato}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={marchio.attivo ? 'Attivo' : 'Disattivo'}
                                            sx={{
                                                fontWeight: 600,
                                                ...(marchio.attivo && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff',
                                                    '& .MuiChip-label': { color: '#ffffff' }
                                                })
                                            }}
                                            color={marchio.attivo ? 'default' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={marchio._count.masterFiles}
                                            sx={marchio._count.masterFiles > 0 ? {
                                                fontWeight: 600,
                                                backgroundColor: '#000000',
                                                color: '#ffffff',
                                                '& .MuiChip-label': { color: '#ffffff' }
                                            } : {}}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={marchio._count.regoleMarkup}
                                            sx={marchio._count.regoleMarkup > 0 ? {
                                                fontWeight: 600,
                                                backgroundColor: '#000000',
                                                color: '#ffffff',
                                                '& .MuiChip-label': { color: '#ffffff' }
                                            } : {}}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={marchio._count.filtri}
                                            sx={marchio._count.filtri > 0 ? {
                                                fontWeight: 600,
                                                backgroundColor: '#000000',
                                                color: '#ffffff',
                                                '& .MuiChip-label': { color: '#ffffff' }
                                            } : {}}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption">
                                            {marchio.note || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenDialog(marchio)}
                                            color="primary"
                                        >
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(marchio)}
                                            color="error"
                                            disabled={marchio._count.masterFiles > 0 || marchio._count.regoleMarkup > 0 || marchio._count.filtri > 0}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Dialog Crea/Modifica */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingMarchio ? 'Modifica Marchio' : 'Nuovo Marchio'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                        <TextField
                            label="Nome Marchio"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                            autoFocus
                            fullWidth
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.attivo}
                                    onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                                />
                            }
                            label="Attivo"
                        />
                        <TextField
                            label="Note"
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            multiline
                            rows={3}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Annulla</Button>
                    <Button onClick={handleSave} variant="contained">
                        {editingMarchio ? 'Salva' : 'Crea'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                aria-labelledby="delete-dialog-title"
            >
                <DialogTitle id="delete-dialog-title">Conferma eliminazione</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Sei sicuro di voler eliminare il marchio "<strong>{marchioToDelete?.nome}</strong>"?
                        Questa azione è irreversibile.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
                        Annulla
                    </Button>
                    <Button onClick={executeDelete} color="error" variant="contained" autoFocus>
                        Elimina
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Marchi;
