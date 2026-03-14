import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';

type NavView = 'dashboard' | 'agents' | 'activity' | 'settings';

interface Props {
  activeNav?: NavView;
}

export default function NavBar({ activeNav = 'dashboard' }: Props) {
  const { theme, toggleTheme, setCurrentView } = useApp();

  return (
    <nav
      className="glass"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(48px) saturate(220%)',
        WebkitBackdropFilter: 'blur(48px) saturate(220%)',
        background: 'rgba(3,7,18,0.85)',
        gap: 32,
      }}
    >
      {/* Wordmark */}
      <button
        onClick={() => setCurrentView('landing')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 0,
        }}
      >
        <span className="pulse-dot" />
        <span style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 20,
          fontWeight: 400,
          letterSpacing: '-0.5px',
          color: 'var(--text-primary)',
        }}>
          AgentFi
        </span>
      </button>

      {/* Center nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 1, justifyContent: 'center' }}>
        {(['Dashboard', 'Agents', 'Activity', 'Settings'] as const).map(label => {
          const view = label.toLowerCase() as NavView;
          const isActive = activeNav === view;
          return (
            <button
              key={label}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (label === 'Dashboard') setCurrentView('dashboard');
              }}
              id={`nav-${view}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Theme toggle */}
        <button
          className="mode-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          id="theme-toggle-btn"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Agents active chip */}
        <div className="glass" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 100,
        }}>
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>
            4 agents active
          </span>
        </div>

        {/* Wallet chip */}
        <div className="wallet-chip">
          <span className="pulse-dot" style={{ width: 7, height: 7 }} />
          0x1234...5678
        </div>
      </div>
    </nav>
  );
}
