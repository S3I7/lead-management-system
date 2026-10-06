import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  quickSwitch: (role: 'ADMIN' | 'STAFF' | 'PARENT') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('writathon_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      const savedToken = localStorage.getItem('writathon_token');
      if (savedToken) {
        try {
          const res = await api.get<User>('/auth/me');
          setUser(res.data);
        } catch {
          localStorage.removeItem('writathon_token');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: loggedUser } = res.data;
    localStorage.setItem('writathon_token', access_token);
    setToken(access_token);
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = () => {
    localStorage.removeItem('writathon_token');
    setToken(null);
    setUser(null);
  };

  const quickSwitch = async (role: 'ADMIN' | 'STAFF' | 'PARENT') => {
    try {
      const res = await api.post(`/auth/quick-switch/${role}`);
      const { access_token, user: switchedUser } = res.data;
      localStorage.setItem('writathon_token', access_token);
      setToken(access_token);
      setUser(switchedUser);
    } catch (err) {
      console.error('Quick switch failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, quickSwitch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
