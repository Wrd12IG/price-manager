import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Dashboard from './pages/Dashboard';
import Fornitori from './pages/Fornitori';
import Mappature from './pages/Mappature';
import Pricing from './pages/Pricing';
import Integrazioni from './pages/Integrazioni';
import Scheduler from './pages/Scheduler';
import Logs from './pages/Logs';
import MasterFile from './pages/MasterFile';
import ProductFilters from './pages/ProductFilters';
import Marchi from './pages/Marchi';
import Categorie from './pages/Categorie';
import Profile from './pages/Profile';

// Layout
import Layout from './components/Layout';

// Tema Material-UI personalizzato
const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#667eea',
            light: '#8b9cf5',
            dark: '#4c5fd4',
        },
        secondary: {
            main: '#764ba2',
            light: '#9168b8',
            dark: '#5a3a7d',
        },
        background: {
            default: '#f5f7fa',
            paper: '#ffffff',
        },
        success: {
            main: '#10b981',
        },
        error: {
            main: '#ef4444',
        },
        warning: {
            main: '#f59e0b',
        },
        info: {
            main: '#3b82f6',
        },
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        h1: {
            fontWeight: 700,
        },
        h2: {
            fontWeight: 700,
        },
        h3: {
            fontWeight: 600,
        },
        h4: {
            fontWeight: 600,
        },
        h5: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 600,
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                    padding: '10px 24px',
                    '& svg': {
                        color: '#FFD700', // Giallo per tutte le icone nei bottoni
                    },
                },
                contained: {
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    '&:hover': {
                        backgroundColor: '#333333',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                },
            },
        },
    },
});

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/fornitori" element={<Fornitori />} />
                        <Route path="/mappature" element={<Mappature />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/integrazioni" element={<Integrazioni />} />
                        <Route path="/scheduler" element={<Scheduler />} />
                        <Route path="/logs" element={<Logs />} />
                        <Route path="/master-file" element={<MasterFile />} />
                        <Route path="/filters" element={<ProductFilters />} />
                        <Route path="/marchi" element={<Marchi />} />
                        <Route path="/categorie" element={<Categorie />} />
                        <Route path="/profile" element={<Profile />} />
                    </Routes>
                </Layout>
            </Router>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
        </ThemeProvider>
    );
}

export default App;
