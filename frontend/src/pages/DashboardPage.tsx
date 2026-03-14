import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus } from 'lucide-react';
import { AGENTS, DASHBOARD_STATS, PORTFOLIO, Agent } from '../data/mockData';
import AmbientBackground from '../components/AmbientBackground';
import AgentDetailPanel from '../components/AgentDetailPanel';
import { useApp } from '../context/AppContext';

// ── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const animate = (now: number) => {
          const pct = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - pct, 3);
          setVal(Math.round(target * eased));
          if (pct < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { val, ref };
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, prefix = '', suffix = '', trend, subtitle }: {
  label: string; value: number; prefix?: string; suffix?: string; trend?: string; subtitle?: string;
}) {
  const { val, ref } = useCountUp(value);

  return (
    <motion.div
      ref={ref}
      className="glass"
      style={{ padding: '28px 24px', flex: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <p className="label-muted" style={{ marginBottom: 8 }}>{label}</p>
      <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 44, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
        {prefix}{val.toLocaleString()}{suffix}
      </div>
      {(trend || subtitle) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {trend && (
            <span style={{ fontFamily: 'Inter', fontSize: 12, color: trend.startsWith('+') ? 'var(--success)' : 'var(--danger)' }}>
              {trend.startsWith('+') ? '▲' : '▼'} {trend}
            </span>
          )}
          {subtitle && <span style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>{subtitle}</span>}
        </div>
      )}
    </motion.div>
  );
}

// ── Pie tooltip ──────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip">
      <div style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{d.name}</div>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: d.fill }}>${d.value.toLocaleString()}</div>
      <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)' }}>{((d.value / PORTFOLIO.total) * 100).toFixed(1)}%</div>
    </div>
  );
}

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: 'var(--text-primary)', minWidth: 24 }}>{score}</span>
      <div className="score-bar">
        <motion.div
          className="score-fill"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { selectedAgent, setSelectedAgent, setCurrentView } = useApp();
  const [portfolioView, setPortfolioView] = useState<'chart' | 'numbers'>('chart');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const bodyDimmed = !!selectedAgent;

  const pieData = [
    { name: 'Debt', value: PORTFOLIO.debt.value, color: PORTFOLIO.debt.color },
    { name: 'Trading', value: PORTFOLIO.trading.value, color: PORTFOLIO.trading.color },
    { name: 'Lent', value: PORTFOLIO.lent.value, color: PORTFOLIO.lent.color },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <AmbientBackground />

      <div
        className="page-content"
        style={{
          opacity: bodyDimmed ? 0.35 : 1,
          pointerEvents: bodyDimmed ? 'none' : 'auto',
          transition: 'opacity 0.25s ease',
        }}
      >
        {/* ── Content ── */}
        <div className="section-container" style={{ paddingTop: 24, paddingBottom: 80 }}>

          {/* ── Stats Row ── */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <StatCard label="AGENTS ACTIVE" value={DASHBOARD_STATS.agentsActive} subtitle={DASHBOARD_STATS.activeBreakdown} />
            <StatCard label="TOTAL CAPITAL" value={DASHBOARD_STATS.totalCapital} prefix="$" subtitle="across all vaults" />
            <StatCard label="LENT OUT" value={DASHBOARD_STATS.lentOut} prefix="$" trend="+2.4%" subtitle="5 active positions" />
            <StatCard label="BORROWED" value={DASHBOARD_STATS.borrowed} prefix="$" subtitle="2 open loans" />
            <StatCard label="OUTSTANDING DEBT" value={DASHBOARD_STATS.outstandingDebt} prefix="$" subtitle={`$${DASHBOARD_STATS.debtInterest} in interest`} />
          </div>

          {/* ── Portfolio Visualization ── */}
          <div className="glass" style={{ padding: '28px 32px', marginBottom: 24, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 26, fontWeight: 400, color: 'var(--text-primary)' }}>
                Portfolio
              </h2>
              <div className="segmented-control">
                <button className={`seg-btn ${portfolioView === 'chart' ? 'active' : ''}`} onClick={() => setPortfolioView('chart')}>Chart</button>
                <button className={`seg-btn ${portfolioView === 'numbers' ? 'active' : ''}`} onClick={() => setPortfolioView('numbers')}>Numbers</button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {portfolioView === 'chart' ? (
                <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
                    <ResponsiveContainer width={280} height={280}>
                      <PieChart>
                        <defs>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={110}
                          paddingAngle={3}
                          cornerRadius={4}
                          dataKey="value"
                          onMouseEnter={(_, i) => setActiveIndex(i)}
                          onMouseLeave={() => setActiveIndex(null)}
                        >
                          {pieData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center label */}
                    <div style={{ position: 'absolute', left: 'calc(280px / 2 + 32px)', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>TOTAL</p>
                      <p style={{ fontFamily: 'Cormorant Garamond', fontSize: 32, fontWeight: 300, color: 'var(--text-primary)' }}>
                        ${PORTFOLIO.total.toLocaleString()}
                      </p>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                      {pieData.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--text-primary)' }}>${d.value.toLocaleString()}</span>
                          <span style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'right' }}>
                            {((d.value / PORTFOLIO.total) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="numbers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pieData.map((d, i) => {
                      const pct = (d.value / PORTFOLIO.total) * 100;
                      return (
                        <div key={i} className="glass" style={{ padding: '20px 24px', borderRadius: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: d.color }} />
                              <span style={{ fontFamily: 'Inter', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{d.name}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 32, fontWeight: 300, color: 'var(--text-primary)' }}>
                                ${d.value.toLocaleString()}
                              </div>
                              <div style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-secondary)' }}>{pct.toFixed(1)}% of portfolio</div>
                            </div>
                          </div>
                          {/* Fill bar */}
                          <div className="portfolio-bar">
                            <motion.div
                              className="portfolio-fill"
                              style={{ background: d.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.1 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Agent List ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 28, fontWeight: 400, color: 'var(--text-primary)' }}>
                Your Agents
              </h2>
              <button
                className="btn btn-ghost"
                style={{ height: 38, padding: '0 18px', fontSize: 13 }}
                onClick={() => setCurrentView('onboarding')}
                id="new-agent-btn"
              >
                <Plus size={14} /> New Agent
              </button>
            </div>

            <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>AGENT</th>
                    <th>ROLE</th>
                    <th>CREDIT SCORE</th>
                    <th>STATUS</th>
                    <th>CAPITAL</th>
                    <th>P&L TODAY</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((agent, i) => (
                    <motion.tr
                      key={agent.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      onClick={() => setSelectedAgent(agent)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Agent */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className={agent.status === 'Active' ? 'agent-dot' : ''} style={agent.status !== 'Active' ? { width: 12, height: 12, borderRadius: '50%', background: 'var(--text-tertiary)', flexShrink: 0 } : {}} />
                          <div>
                            <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 15, fontWeight: 400, color: 'var(--text-primary)' }}>
                              {agent.name.split('.')[0]}
                            </div>
                            <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)' }}>
                              {agent.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td>
                        <span className={`badge badge-${agent.role.toLowerCase()}`}>{agent.role}</span>
                      </td>
                      {/* Score */}
                      <td><ScoreBar score={agent.score} /></td>
                      {/* Status */}
                      <td>
                        <span className={`badge badge-${agent.status.toLowerCase()}`}>{agent.status}</span>
                      </td>
                      {/* Capital */}
                      <td>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: 'var(--text-primary)' }}>
                          ${agent.capital.toLocaleString()}
                        </span>
                      </td>
                      {/* P&L */}
                      <td>
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 500,
                          color: agent.pnlToday >= 0 ? 'var(--success)' : 'var(--danger)',
                        }}>
                          {agent.pnlToday >= 0 ? '+' : ''}{agent.pnlToday !== 0 ? `$${Math.abs(agent.pnlToday)}` : '$0'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Agent Detail Panel ── */}
      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailPanel
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
