import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    user: any;
    login: (token: string, refreshToken: string, user: any) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const token = localStorage.getItem('token');
        return !!token;
    });
    const [user, setUser] = useState<any>(() => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    });

    const login = (token: string, refreshToken: string, userData: any) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setIsAuthenticated(true);
        setUser(userData);
    };

    const logout = async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                await fetch('https://api.pricemanager.wrdigital.it/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
            } catch (e) {
                console.error('Logout API error:', e);
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
    };

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'token') setIsAuthenticated(!!e.newValue);
            if (e.key === 'user') setUser(e.newValue ? JSON.parse(e.newValue) : null);
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
