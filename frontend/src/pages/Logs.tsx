import { Box, Typography, Paper } from '@mui/material';

export default function Logs() {
    return (
        <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
                Log & Monitor
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Visualizza i log delle esecuzioni e monitora il sistema
            </Typography>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                    Pagina in sviluppo
                </Typography>
            </Paper>
        </Box>
    );
}
