import { useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    Drawer,
    AppBar,
    Toolbar,
    List,
    Typography,
    Divider,
    IconButton,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Container,
    Avatar,
    Menu,
    MenuItem,
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Store as StoreIcon,
    MapOutlined as MapIcon,
    LocalOffer as PriceIcon,
    Extension as IntegrationIcon,
    Schedule as ScheduleIcon,
    Assignment as LogIcon,
    Inventory as InventoryIcon,
    AccountCircle,
    FilterList as FilterIcon,
    Star as StarIcon,
    Folder as FolderIcon,
    AdminPanelSettings as AdminIcon,
    AutoFixHigh as NormalizationIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 280;

interface MenuItemType {
    text: string;
    icon: ReactNode;
    path: string;
    adminOnly?: boolean;
}

const menuItems: MenuItemType[] = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Amministrazione', icon: <AdminIcon />, path: '/admin', adminOnly: true },
    { text: 'Fornitori', icon: <StoreIcon />, path: '/fornitori' },
    { text: 'Mappature', icon: <MapIcon />, path: '/mappature' },
    { text: 'Marchi', icon: <StarIcon />, path: '/marchi' },
    { text: 'Categorie', icon: <FolderIcon />, path: '/categorie' },
    { text: 'Normalizzazione', icon: <NormalizationIcon />, path: '/normalization' },
    { text: 'Regole Pricing', icon: <PriceIcon />, path: '/pricing' },
    { text: 'Filtri Prodotti', icon: <FilterIcon />, path: '/filters' },
    { text: 'Master File', icon: <InventoryIcon />, path: '/master-file' },
    { text: 'Integrazioni', icon: <IntegrationIcon />, path: '/integrazioni' },
    { text: 'Pianificazione', icon: <ScheduleIcon />, path: '/scheduler' },
    { text: 'Log e Monitoraggio', icon: <LogIcon />, path: '/logs' },
];

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const userRole = user?.ruolo || null;

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        await logout();
    };

    const drawer = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#000000', color: 'white' }}>
            <Toolbar
                sx={{
                    backgroundColor: '#000000',
                    color: 'white',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        W<Box component="span" sx={{ color: '#FFD700' }}>[</Box>r<Box component="span" sx={{ color: '#FFD700' }}>]</Box>Digital
                    </Typography>
                    <Typography variant="body2" component="div" sx={{ fontWeight: 500, letterSpacing: 1, opacity: 0.9 }}>
                        Price Manager
                    </Typography>
                </Box>
            </Toolbar>
            <List sx={{ flex: 1, pt: 2 }}>
                {menuItems
                    .filter(item => !item.adminOnly || userRole === 'admin')
                    .map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <ListItem key={item.text} disablePadding sx={{ px: 2, mb: 0.5 }}>
                                <ListItemButton
                                    onClick={() => navigate(item.path)}
                                    sx={{
                                        borderRadius: 2,
                                        backgroundColor: isActive ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                                        color: isActive ? '#FFD700' : 'white',
                                        '&:hover': {
                                            backgroundColor: isActive
                                                ? 'rgba(255, 215, 0, 0.25)'
                                                : 'rgba(255, 255, 255, 0.08)',
                                        },
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#FFD700', minWidth: 40 }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontWeight: isActive ? 600 : 400,
                                            fontSize: '0.95rem',
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
            </List>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
            <Box sx={{ p: 2, textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                    v2.0.0
                </Typography>
                <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', mt: 0.5 }}>
                    Last updated: 26/01/2026
                </Typography>
                <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', mt: 1, opacity: 0.7 }}>
                    © 2026 WR Digital
                </Typography>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* AppBar */}
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { sm: `${drawerWidth}px` },
                    backgroundColor: 'white',
                    color: 'text.primary',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton onClick={handleMenuClick} sx={{ ml: 2 }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: '#000000', color: '#FFD700' }}>
                            <AccountCircle />
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                    >
                        <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>Profilo</MenuItem>
                        <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>Impostazioni</MenuItem>
                        <Divider />
                        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>Esci</MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Drawer */}
            <Box
                component="nav"
                sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
            >
                {/* Mobile drawer */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true,
                    }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
                {/* Desktop drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    minHeight: '100vh',
                    backgroundColor: '#f5f7fa',
                }}
            >
                <Toolbar />
                <Container maxWidth="xl" sx={{ py: 3 }}>
                    {children}
                </Container>
            </Box>
        </Box>
    );
}
