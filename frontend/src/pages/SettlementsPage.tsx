import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import { useApi } from '../context/ApiContext';
import type { Loan, AdminOverviewResponse, UserAgent } from '../types/api';

interface EnrichedLoan extends Loan {
  borrowerEns: string;
  lenderEns: string;
}

interface AgentStats {
  totalAgents: number;
  runningAgents: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  repaid: {
    label: 'Repaid',
    color: 'var(--success)',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.25)',
    icon: <CheckCircle2 size={14} />,
  },
  active: {
    label: 'Active',
    color: 'var(--accent)',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.25)',
    icon: <Clock size={14} />,
  },
  defaulted: {
    label: 'Defaulted',
    color: 'var(--danger)',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
    icon: <AlertTriangle size={14} />,
  },
};

function getStatusConfig(status: string) {
  const key = status.toLowerCase();
  return STATUS_CONFIG[key] || STATUS_CONFIG.active;
}

function formatUsdc(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncateEns(name: string, max = 24) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type FilterKey = 'all' | 'active' | 'repaid' | 'defaulted';

export default function SettlementsPage() {
  const { api } = useApi();
  const [loans, setLoans] = useState<EnrichedLoan[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats>({ totalAgents: 0, runningAgents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchSettlements = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview: AdminOverviewResponse = await api.getAdminOverview();
      const agents = overview.agents || [];

      const running = agents.filter(
        (a: UserAgent) => (a.runtime_status || a.status || '').toLowerCase() === 'active'
      ).length;
      setAgentStats({ totalAgents: agents.length, runningAgents: running });

      const walletToEns = new Map<string, string>();
      agents.forEach(a => {
        walletToEns.set(a.wallet_address.toLowerCase(), a.ens_name);
      });

      const loanMap = new Map<number, EnrichedLoan>();

      const fetchPromises = agents.map(async (agent) => {
        const [asLender, asBorrower] = await Promise.allSettled([
          api.getAgentLoans(agent.agent_id, 'lender'),
          api.getAgentLoans(agent.agent_id, 'borrower'),
        ]);
        const allLoans: Loan[] = [];
        if (asLender.status === 'fulfilled') allLoans.push(...asLender.value.loans);
        if (asBorrower.status === 'fulfilled') allLoans.push(...asBorrower.value.loans);
        return allLoans;
      });

      const results = await Promise.allSettled(fetchPromises);
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          r.value.forEach(loan => {
            if (!loanMap.has(loan.loanId)) {
              loanMap.set(loan.loanId, {
                ...loan,
                borrowerEns: walletToEns.get(loan.borrower.toLowerCase()) || `${loan.borrower.slice(0, 6)}…${loan.borrower.slice(-4)}`,
                lenderEns: walletToEns.get(loan.lender.toLowerCase()) || `${loan.lender.slice(0, 6)}…${loan.lender.slice(-4)}`,
              });
            }
          });
        }
      });

      const sorted = Array.from(loanMap.values()).sort((a, b) => {
        const dateA = a.repaidAt || a.dueAt || '';
        const dateB = b.repaidAt || b.dueAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setLoans(sorted);
    } catch (e: any) {
      setError(e.message || 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return loans;
    return loans.filter(l => l.status.toLowerCase() === filter);
  }, [loans, filter]);

  const stats = useMemo(() => {
    const total = loans.length;
    const repaid = loans.filter(l => l.status.toLowerCase() === 'repaid').length;
    const active = loans.filter(l => l.status.toLowerCase() === 'active').length;
    const totalVolume = loans.reduce((s, l) => s + l.principalUsdc, 0);
    const totalInterest = loans.reduce((s, l) => s + l.interestUsdc, 0);
    return { total, repaid, active, totalVolume, totalInterest };
  }, [loans]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'repaid', label: 'Repaid' },
    { key: 'defaulted', label: 'Defaulted' },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AmbientBackground />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1100, margin: '0 auto', padding: '48px 32px 120px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 48 }}
        >
          <p className="label-ui" style={{ marginBottom: 12 }}>NETWORK ACTIVITY</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <h1 style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 'clamp(36px, 5vw, 52px)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              letterSpacing: '-1px',
            }}>
              Loan Settlements
            </h1>
            <button
              className="btn btn-ghost"
              style={{ height: 40, padding: '0 20px', fontSize: 13 }}
              onClick={fetchSettlements}
              disabled={loading}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            color: 'var(--text-secondary)',
            marginTop: 8,
            lineHeight: 1.7,
          }}>
            Real-time view of all loan settlements between agents on the network.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 40,
          }}
        >
          {[
            { label: 'Total Agents', value: agentStats.totalAgents.toString(), mono: true, accent: false },
            { label: 'Running Agents', value: agentStats.runningAgents.toString(), mono: true, accent: true },
            { label: 'Total Loans', value: stats.total.toString(), mono: true, accent: false },
            { label: 'Volume', value: formatUsdc(stats.totalVolume), mono: true, accent: false },
            { label: 'Interest Earned', value: formatUsdc(stats.totalInterest), mono: true, accent: false },
            { label: 'Repaid', value: `${stats.repaid}/${stats.total}`, mono: true, accent: false },
            { label: 'Active Loans', value: stats.active.toString(), mono: true, accent: false },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="glass"
              style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, var(--accent), rgba(59,130,246,0.6))`,
                opacity: 0.4,
              }} />
              <p className="label-muted" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {stat.accent && <span className="pulse-dot" style={{ width: 6, height: 6 }} />}
                {stat.label}
              </p>
              <p style={{
                fontFamily: stat.mono ? 'JetBrains Mono, monospace' : 'Cormorant Garamond, serif',
                fontSize: stat.mono ? 22 : 28,
                fontWeight: stat.mono ? 500 : 300,
                color: stat.accent ? 'var(--accent)' : 'var(--text-primary)',
              }}>
                {stat.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ display: 'flex', gap: 8, marginBottom: 24 }}
        >
          {filters.map(f => (
            <button
              key={f.key}
              className={`filter-pill ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '80px 0' }}
          >
            <div style={{
              width: 32,
              height: 32,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)' }}>
              Loading settlements…
            </p>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass"
            style={{ padding: 32, textAlign: 'center' }}
          >
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--danger)', marginBottom: 12 }}>
              {error}
            </p>
            <button className="btn btn-ghost" style={{ height: 40, padding: '0 20px', fontSize: 13 }} onClick={fetchSettlements}>
              Try Again
            </button>
          </motion.div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass"
            style={{ padding: '60px 32px', textAlign: 'center' }}
          >
            <p style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 24,
              fontWeight: 300,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}>
              No settlements yet
            </p>
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)' }}>
              Loan settlements will appear here once agents start transacting.
            </p>
          </motion.div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((loan, i) => {
                const sc = getStatusConfig(loan.status);
                const isRepaid = loan.status.toLowerCase() === 'repaid';
                return (
                  <motion.div
                    key={loan.loanId}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                    className="glass"
                    style={{
                      padding: '24px 28px',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'default',
                    }}
                  >
                    {/* Top gradient line */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: isRepaid
                        ? 'linear-gradient(90deg, rgba(34,197,94,0.4), transparent 60%)'
                        : 'linear-gradient(90deg, rgba(16,185,129,0.3), transparent 60%)',
                    }} />

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr auto auto',
                      alignItems: 'center',
                      gap: 24,
                    }}>
                      {/* Lender */}
                      <div style={{ minWidth: 0 }}>
                        <p className="label-muted" style={{ marginBottom: 6, fontSize: 10 }}>LENDER</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pulse-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 14,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }} title={loan.lenderEns}>
                            {truncateEns(loan.lenderEns)}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }}>
                        <ArrowRight size={16} color="var(--accent)" />
                      </div>

                      {/* Borrower */}
                      <div style={{ minWidth: 0 }}>
                        <p className="label-muted" style={{ marginBottom: 6, fontSize: 10 }}>BORROWER</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pulse-dot" style={{ width: 6, height: 6, background: 'var(--warning)', flexShrink: 0 }} />
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 14,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }} title={loan.borrowerEns}>
                            {truncateEns(loan.borrowerEns)}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ textAlign: 'right', minWidth: 120 }}>
                        <p className="label-muted" style={{ marginBottom: 6, fontSize: 10 }}>AMOUNT</p>
                        <p style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 18,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}>
                          {formatUsdc(loan.principalUsdc)}
                        </p>
                        {loan.interestUsdc > 0 && (
                          <p style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11,
                            color: 'var(--accent)',
                            marginTop: 2,
                          }}>
                            +{formatUsdc(loan.interestUsdc)} interest
                          </p>
                        )}
                      </div>

                      {/* Status + time */}
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: sc.bg,
                          border: `1px solid ${sc.border}`,
                          color: sc.color,
                          fontSize: 11,
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                        }}>
                          {sc.icon}
                          {sc.label}
                        </div>
                        <p style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          marginTop: 6,
                        }}>
                          {isRepaid ? timeAgo(loan.repaidAt) : `Due ${timeAgo(loan.dueAt)}`}
                        </p>
                      </div>
                    </div>

                    {/* Collateral info */}
                    {loan.collateralUsdc > 0 && (
                      <div style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        gap: 24,
                      }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          Collateral: <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>{formatUsdc(loan.collateralUsdc)}</span>
                        </span>
                        <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          Loan #{loan.loanId}
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          [style*="gridTemplateColumns: '1fr auto 1fr auto auto'"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
