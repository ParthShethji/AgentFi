import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Agent } from '../data/mockData';

type Theme = 'dark' | 'light';
type View = 'landing' | 'onboarding' | 'dashboard';

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  currentView: View;
  setCurrentView: (v: View) => void;
  selectedAgent: Agent | null;
  setSelectedAgent: (a: Agent | null) => void;
  onboardingStep: number;
  setOnboardingStep: (s: number) => void;
  walletConnected: boolean;
  setWalletConnected: (b: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('agentfi-theme') as Theme) || 'dark';
  });
  const [currentView, setCurrentView] = useState<View>('landing');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agentfi-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      currentView, setCurrentView,
      selectedAgent, setSelectedAgent,
      onboardingStep, setOnboardingStep,
      walletConnected, setWalletConnected,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
