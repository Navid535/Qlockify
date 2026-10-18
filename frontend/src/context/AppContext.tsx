import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getUserProfile } from '../api/users';

interface User {
  id: string;
  mobile: string;
  first_name: string;
  last_name: string;
  email?: string;
  profile_picture?: string | null;
}

interface AppContextType {
  user: User | null;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = async () => {
    try {
      const userData = await getUserProfile();
      setUser(userData);
    } catch (error) {
      console.error("Failed to fetch user context data:", error);
      setUser(null);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('accessToken')) {
      void refreshUser();
    }
  }, []);

  return (
    <AppContext.Provider value={{ user, refreshUser }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
