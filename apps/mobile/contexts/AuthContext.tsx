import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, User } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  serverUrl: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setServerUrl: (url: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setServerUrlState] = useState('');

  useEffect(() => {
    const init = async () => {
      const hasToken = await api.initialize();
      setIsAuthenticated(hasToken);
      setServerUrlState(api.getServerUrl());
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const setServerUrl = (url: string) => {
    api.setServerUrl(url);
    setServerUrlState(url);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        serverUrl,
        login,
        logout,
        setServerUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
