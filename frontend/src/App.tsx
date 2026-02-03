import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

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
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import Normalization from './pages/Normalization';

// Layout
import Layout from './components/Layout';

// Tema Material-UI
const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#475569' }, // Slate 600
        secondary: { main: '#64748b' }, // Slate 500
        background: { default: '#f8fafc', paper: '#ffffff' },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                },
            },
        },
    },
});

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route
                path="/login"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
            />

            <Route path="/" element={
                <ProtectedRoute>
                    <Layout>
                        <Navigate to="/dashboard" replace />
                    </Layout>
                </ProtectedRoute>
            } />

            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <Layout><Dashboard /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/fornitori" element={
                <ProtectedRoute>
                    <Layout><Fornitori /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/mappature" element={
                <ProtectedRoute>
                    <Layout><Mappature /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/pricing" element={
                <ProtectedRoute>
                    <Layout><Pricing /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/integrazioni" element={
                <ProtectedRoute>
                    <Layout><Integrazioni /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/scheduler" element={
                <ProtectedRoute>
                    <Layout><Scheduler /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/logs" element={
                <ProtectedRoute>
                    <Layout><Logs /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/master-file" element={
                <ProtectedRoute>
                    <Layout><MasterFile /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/filters" element={
                <ProtectedRoute>
                    <Layout><ProductFilters /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/marchi" element={
                <ProtectedRoute>
                    <Layout><Marchi /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/categorie" element={
                <ProtectedRoute>
                    <Layout><Categorie /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/normalization" element={
                <ProtectedRoute>
                    <Layout><Normalization /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/admin" element={
                <ProtectedRoute>
                    <Layout><AdminPanel /></Layout>
                </ProtectedRoute>
            } />
            <Route path="/profile" element={
                <ProtectedRoute>
                    <Layout><Profile /></Layout>
                </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <Router>
                    <AppRoutes />
                </Router>
            </AuthProvider>
            <ToastContainer position="top-right" autoClose={3000} />
        </ThemeProvider>
    );
}

export default App;
