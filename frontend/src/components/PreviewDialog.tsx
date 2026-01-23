import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Box,
    Typography,
    Alert
} from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../utils/api';

interface PreviewDialogProps {
    open: boolean;
    onClose: () => void;
    fornitoreId: number | null;
    nomeFornitore: string;
}

interface PreviewData {
    headers: string[];
    rows: any[];
    totalRows: number;
    previewRows: number;
}

export default function PreviewDialog({ open, onClose, fornitoreId, nomeFornitore }: PreviewDialogProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<PreviewData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && fornitoreId) {
            fetchPreview();
        } else {
            setData(null);
            setError(null);
        }
    }, [open, fornitoreId]);

    const fetchPreview = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/api/fornitori/${fornitoreId}/preview?rows=10`);
            setData(response.data.data);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error?.message || 'Errore durante il caricamento dell\'anteprima');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                Anteprima Listino - {nomeFornitore}
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : data ? (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Visualizzando prime {data.rows.length} righe di {data.totalRows} totali.
                        </Typography>

                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        {data.headers.map((header, index) => (
                                            <TableCell key={index} sx={{ fontWeight: 600, backgroundColor: '#f5f5f5' }}>
                                                {header}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.rows.map((row, rowIndex) => (
                                        <TableRow key={rowIndex} hover>
                                            {data.headers.map((header, colIndex) => (
                                                <TableCell key={`${rowIndex}-${colIndex}`}>
                                                    {row[header]?.toString() || ''}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                ) : (
                    <Typography color="text.secondary">Nessun dato disponibile</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Chiudi</Button>
            </DialogActions>
        </Dialog>
    );
}
