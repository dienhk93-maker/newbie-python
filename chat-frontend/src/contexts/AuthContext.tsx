import React, { createContext, useContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
  token: string | null;
  userRole: string | null;
  userId: string | null;
  setTokens: (accessToken: string | null, refreshToken?: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('access_token');
  });

  const [userRole, setUserRole] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      try {
        const decoded: any = jwtDecode(storedToken);
        return decoded?.role || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [userId, setUserId] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      try {
        const decoded: any = jwtDecode(storedToken);
        return decoded?.sub || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const setTokens = useCallback((accessToken: string | null, refreshToken?: string | null) => {
    setTokenState(accessToken);
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
      try {
        const decoded: any = jwtDecode(accessToken);
        setUserRole(decoded?.role || null);
        setUserId(decoded?.sub || null);
      } catch (e) {
        setUserRole(null);
        setUserId(null);
      }

      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUserRole(null);
    }
  }, []);

  const logout = useCallback(() => {
    setTokens(null);
  }, [setTokens]);

  const executeRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefresh = localStorage.getItem('refresh_token');
    if (!storedRefresh) {
      logout();
      return null;
    }
    
    try {
      const data = await authService.refresh(storedRefresh);
      setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch (e) {
      console.error('Session expired, failed to refresh token.');
      logout();
      return null;
    }
  }, [logout, setTokens]);

  return (
    <AuthContext.Provider value={{ token, userRole, userId, setTokens, isAuthenticated: !!token, logout, refreshToken: executeRefresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

