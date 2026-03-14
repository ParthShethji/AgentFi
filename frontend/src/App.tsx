import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider } from './context/AppContext';
import { ApiProvider } from './context/ApiContext';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import CreateAgentPage from './pages/CreateAgentPage';
import DashboardPage from './pages/DashboardPage';
import NavBar from './components/NavBar';

function AnimatedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: location.pathname === '/' ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: location.pathname === '/' ? 0 : -16 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AnimatedRoute>
            <LandingPage />
          </AnimatedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <AnimatedRoute>
            <OnboardingPage />
          </AnimatedRoute>
        }
      />
      <Route
        path="/create-agent"
        element={
          <AnimatedRoute>
            <CreateAgentPage />
          </AnimatedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AnimatedRoute>
            <NavBar activeNav="dashboard" />
            <DashboardPage />
          </AnimatedRoute>
        }
      />
    </Routes>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ApiProvider>
        <AppContent />
      </ApiProvider>
    </AppProvider>
  );
}
