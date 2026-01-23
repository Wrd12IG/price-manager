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

interface Categoria {
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

const Categorie: React.FC = () => {
    const [categorie, setCategorie] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        attivo: true,
        note: ''
    });

    // Delete Dialog State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null);

    useEffect(() => {
        fetchCategorie();
    }, [showActiveOnly]);

    const fetchCategorie = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (showActiveOnly) params.attivo = 'true';

            const response = await api.get('/categorie', { params });
            setCategorie(response.data?.data || []);
        } catch (error: any) {
            toast.error('Errore nel caricamento delle categorie');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (categoria?: Categoria) => {
        if (categoria) {
            setEditingCategoria(categoria);
            setFormData({
                nome: categoria.nome,
                attivo: categoria.attivo,
                note: categoria.note || ''
            });
        } else {
            setEditingCategoria(null);
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
        setEditingCategoria(null);
    };

    const handleSave = async () => {
        if (!formData.nome.trim()) {
            toast.error('Il nome della categoria è obbligatorio');
            return;
        }

        try {
            if (editingCategoria) {
                // Update
                await api.put(`/categorie/${editingCategoria.id}`, formData);
                toast.success('Categoria aggiornata con successo');
            } else {
                // Create
                await api.post('/categorie', formData);
                toast.success('Categoria creata con successo');
            }

            handleCloseDialog();
            fetchCategorie();
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Errore nel salvataggio';
            toast.error(message);
        }
    };

    const handleDelete = (categoria: Categoria) => {
        const totalUsage = categoria._count.masterFiles + categoria._count.regoleMarkup + categoria._count.filtri;

        if (totalUsage > 0) {
            toast.warning(
                `Impossibile eliminare. La categoria è utilizzata in ${totalUsage} record (${categoria._count.masterFiles} prodotti, ${categoria._count.regoleMarkup} regole pricing, ${categoria._count.filtri} filtri)`
            );
            return;
        }

        setCategoriaToDelete(categoria);
        setDeleteDialogOpen(true);
    };

    const executeDelete = async () => {
        if (!categoriaToDelete) return;
        setDeleteDialogOpen(false);

        try {
            await api.delete(`/categorie/${categoriaToDelete.id}`);
            toast.success('Categoria eliminata con successo');
            fetchCategorie();
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Errore nell\'eliminazione';
            toast.error(message);
        } finally {
            setCategoriaToDelete(null);
        }
    };

    const filteredCategorie = categorie.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.normalizzato.includes(searchTerm.toUpperCase())
    );

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Gestione Categorie</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon sx={{ color: '#FFD700' }} />}
                    onClick={() => handleOpenDialog()}
                >
                    Nuova Categoria
                </Button>
            </Box>

            <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder="Cerca categoria..."
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
                        label="Solo Attive"
                    />
                </Box>

                <Alert severity="info" sx={{ mt: 2 }}>
                    Totale categorie: {(filteredCategorie?.length || 0)} {showActiveOnly && '(solo attive)'}
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
                            {filteredCategorie?.map((categoria) => (
                                <TableRow key={categoria.id} hover>
                                    <TableCell>{categoria.id}</TableCell>
                                    <TableCell>
                                        <Typography variant="body1" fontWeight="500">
                                            {categoria.nome}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {categoria.normalizzato}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={categoria.attivo ? 'Attiva' : 'Disattiva'}
                                            sx={{
                                                fontWeight: 600,
                                                ...(categoria.attivo && {
                                                    backgroundColor: '#000000',
                                                    color: '#ffffff',
                                                    '& .MuiChip-label': { color: '#ffffff' }
                                                })
                                            }}
                                            color={categoria.attivo ? 'default' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={categoria._count.masterFiles}
                                            sx={categoria._count.masterFiles > 0 ? {
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
                                            label={categoria._count.regoleMarkup}
                                            sx={categoria._count.regoleMarkup > 0 ? {
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
                                            label={categoria._count.filtri}
                                            sx={categoria._count.filtri > 0 ? {
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
                                            {categoria.note || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenDialog(categoria)}
                                            color="primary"
                                        >
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(categoria)}
                                            color="error"
                                            disabled={categoria._count.masterFiles > 0 || categoria._count.regoleMarkup > 0 || categoria._count.filtri > 0}
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
                    {editingCategoria ? 'Modifica Categoria' : 'Nuova Categoria'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                        <TextField
                            label="Nome Categoria"
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
                            label="Attiva"
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
                        {editingCategoria ? 'Salva' : 'Crea'}
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
                        Sei sicuro di voler eliminare la categoria "<strong>{categoriaToDelete?.nome}</strong>"?
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

export default Categorie;
