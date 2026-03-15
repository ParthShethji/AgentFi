import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Play, Pause, RefreshCw } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import AgentDetailPanel from '../components/AgentDetailPanel';
import { useApp } from '../context/AppContext';
import { useApi } from '../context/ApiContext';
import type { UserAgent } from '../types/api';
import type { Agent } from '../data/mockData';
import { getChainLabel } from '../wallet/metamask';

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

function toPanelAgent(agent: UserAgent): Agent {
  return {
    id: agent.agent_id,
    name: agent.ens_name,
    role: agent.role === 'lender' ? 'Lender' : 'Trader',
    score: agent.reputation_score,
    status: agent.runtime_status === 'active' ? 'Active' : agent.runtime_status === 'paused' ? 'Idle' : 'Defaulted',
    capital: Number(agent.total_lent_usdc || 0) + Number(agent.total_borrowed_usdc || 0),
    pnlToday: Number(agent.total_profit_usdc || 0),
    lent: Number(agent.total_lent_usdc || 0),
    borrowed: Number(agent.total_borrowed_usdc || 0),
  };
}

function StatCard({ label, value, suffix = '' }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="glass" style={{ padding: '22px 20px', borderRadius: 16, flex: 1 }}>
      <div className="label-muted" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 38, color: 'var(--text-primary)' }}>
        {value}{suffix}
      </div>
    </div>
  );
}

function relativeTime(value?: string | null) {
  if (!value) return 'pending';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { api } = useApi();
  const { userId, selectedAgent, setSelectedAgent, createdAgentId, walletChainId } = useApp();
  const [borrowAmount, setBorrowAmount] = useState('100');
  const [borrowQuote, setBorrowQuote] = useState<Awaited<ReturnType<typeof api.getBorrowQuote>> | null>(null);
  const [triggerFeedback, setTriggerFeedback] = useState<Record<string, { message: string; ok: boolean }>>({});

  const { data: userAgentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['userAgents', userId],
    queryFn: () => api.getUserAgents(userId!),
    enabled: !!userId,
    refetchInterval: 4000,
  });
  const { data: adminOverview, isLoading: overviewLoading } = useQuery({
    queryKey: ['adminOverview'],
    queryFn: () => api.getAdminOverview(),
    refetchInterval: 4000,
  });
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['offers', 0, 1000],
    queryFn: () => api.getOffers(0, 1000),
    refetchInterval: 5000,
  });

  const agents = userAgentsData?.agents ?? [];
  const borrowerAgent = agents.find((agent) => agent.role === 'borrower') ?? null;

  const scheduleRefreshes = (agentId: string) => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['userAgents', userId] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['agentRuntime', agentId] });
    };
    [3000, 8000, 16000, 25000, 35000].forEach((ms) => setTimeout(invalidate, ms));
  };

  const triggerMutation = useMutation({
    mutationFn: (agentId: string) => api.runAgent(agentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['userAgents', userId] });
      const agentId = data.agentId;
      if (data.triggered) {
        scheduleRefreshes(agentId);
      }
      setTriggerFeedback((prev) => ({
        ...prev,
        [agentId]: { message: data.message || (data.triggered ? 'Cycle triggered' : 'Already running'), ok: data.triggered },
      }));
      setTimeout(() => setTriggerFeedback((prev) => { const n = { ...prev }; delete n[agentId]; return n; }), 4000);
    },
    onError: (_err, agentId) => {
      setTriggerFeedback((prev) => ({
        ...prev,
        [agentId]: { message: 'Failed to trigger', ok: false },
      }));
      setTimeout(() => setTriggerFeedback((prev) => { const n = { ...prev }; delete n[agentId]; return n; }), 4000);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ agentId, runtimeStatus }: { agentId: string; runtimeStatus: 'active' | 'paused' | 'stopped' }) =>
      api.updateAgentStatus(agentId, runtimeStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['userAgents'] });
    },
  });

  const requestBorrowMutation = useMutation({
    mutationFn: (payload: { borrowerAgentId: string; requestedAmountUsdc: number }) => api.requestBorrow(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      queryClient.invalidateQueries({ queryKey: ['userAgents'] });
      setBorrowQuote(null);
    },
  });
  const summary = useMemo(() => {
    const totalAgents = agents.length;
    const activeAgents = agents.filter((agent) => (agent.runtime_status || agent.status) === 'active').length;
    const totalProfit = agents.reduce((sum, agent) => sum + Number(agent.total_profit_usdc || 0), 0);
    const totalBorrowed = agents.reduce((sum, agent) => sum + Number(agent.total_borrowed_usdc || 0), 0);
    return { totalAgents, activeAgents, totalProfit, totalBorrowed };
  }, [agents]);

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <AmbientBackground />
      <div className="page-content">
        <div className="section-container" style={{ paddingTop: 24, paddingBottom: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div className="label-ui">My Dashboard</div>
              <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 40, fontWeight: 400, color: 'var(--text-primary)' }}>
                Your Control Room
              </h1>
            </div>
            <button className="btn btn-ghost" style={{ height: 38, padding: '0 18px', fontSize: 13 }} onClick={() => navigate('/create-agent')}>
              <Plus size={14} /> New Agent
            </button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="My Agents" value={agentsLoading ? '...' : summary.totalAgents} />
            <StatCard label="Running" value={agentsLoading ? '...' : summary.activeAgents} />
            <StatCard label="My Profit" value={agentsLoading ? '...' : `$${summary.totalProfit.toFixed(2)}`} />
            <StatCard label="My Borrowed" value={agentsLoading ? '...' : `$${summary.totalBorrowed.toFixed(2)}`} />
          </div>

          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.9fr)', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <div className="glass" style={{ padding: '24px 28px', borderRadius: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 28, color: 'var(--text-primary)' }}>Your Runtime Agents</h2>
                  <span style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {agentsLoading ? 'syncing...' : `${agents.length} agents`}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {agents.map((agent) => (
                    <motion.div
                      key={agent.agent_id}
                      className="glass"
                      style={{ padding: '18px 20px', borderRadius: 14, cursor: 'pointer', minWidth: 0 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setSelectedAgent(toPanelAgent(agent))}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 24, color: 'var(--text-primary)' }}>
                            {agent.ens_name}
                          </div>
                          <div style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {agent.role} | score {agent.reputation_score} | {agent.risk_tolerance}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`badge badge-${agent.runtime_status === 'active' ? 'active' : agent.runtime_status === 'paused' ? 'idle' : 'defaulted'}`}>
                            {agent.runtime_status || agent.status}
                          </span>
                          <button
                            className="btn btn-ghost"
                            style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                            disabled={triggerMutation.isPending && triggerMutation.variables === agent.agent_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              triggerMutation.mutate(agent.agent_id);
                            }}
                          >
                            {triggerMutation.isPending && triggerMutation.variables === agent.agent_id ? (
                              <><RefreshCw size={12} className="spin" /> Triggering…</>
                            ) : triggerFeedback[agent.agent_id] ? (
                              <span style={{ color: triggerFeedback[agent.agent_id].ok ? 'var(--success)' : 'var(--danger)' }}>
                                {triggerFeedback[agent.agent_id].message}
                              </span>
                            ) : (
                              <><Play size={12} /> Run now</>
                            )}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              statusMutation.mutate({
                                agentId: agent.agent_id,
                                runtimeStatus: agent.runtime_status === 'active' ? 'paused' : 'active',
                              });
                            }}
                          >
                            {agent.runtime_status === 'active' ? <Pause size={12} /> : <RefreshCw size={12} />}
                            {agent.runtime_status === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
                        <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                          <div className="label-muted">Cycles</div>
                          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{agent.total_cycles || 0}</div>
                        </div>
                        <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                          <div className="label-muted">Profit</div>
                          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--success)' }}>${Number(agent.total_profit_usdc || 0).toFixed(2)}</div>
                        </div>
                        <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                          <div className="label-muted">Borrowed</div>
                          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>${Number(agent.total_borrowed_usdc || 0).toFixed(2)}</div>
                        </div>
                        <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                          <div className="label-muted">Last run</div>
                          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{relativeTime(agent.last_execution_at)}</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
                        <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                          <div className="label-muted">Wallet ETH</div>
                          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
                            {Number(agent.eth_balance || 0).toFixed(4)}
                          </div>
                        </div>
                        <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                          <div className="label-muted">Wallet USDC</div>
                          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
                            {Number(agent.usdc_balance || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {agent.last_result_summary || 'No cycles recorded yet.'}
                      </div>
                      <div style={{ marginTop: 12, fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Open details to fund this agent from your connected wallet on {getChainLabel(walletChainId)} and inspect live balances.
                      </div>
                    </motion.div>
                  ))}
                  {!agents.length && !agentsLoading && (
                    <div style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)' }}>
                      No agents yet. Create one to begin the autonomous loop.
                    </div>
                  )}
                </div>
              </div>

              <div className="glass" style={{ padding: '24px 28px', borderRadius: 18, minWidth: 0 }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 28, color: 'var(--text-primary)', marginBottom: 16 }}>
                  Agent Thinking Feed
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
                  {(adminOverview?.recentLogs ?? []).map((log) => (
                    <div key={log.log_id} className="glass feed-log-card" style={{ padding: '14px 16px', borderRadius: 12 }}>
                      <div className="feed-log-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--accent)' }}>
                          {log.ens_name}
                        </div>
                        <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {relativeTime(log.created_at)}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        {log.role} | {log.phase} {log.tool_name ? `| tool ${log.tool_name}` : ''}
                      </div>
                      <div
                        className="feed-log-message"
                        title={log.message}
                        style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}
                      >
                        {log.message}
                      </div>
                    </div>
                  ))}
                  {!adminOverview?.recentLogs?.length && (
                    <div style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)' }}>
                      Agent execution logs will appear here once the runtime manager starts cycling.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <div className="glass" style={{ padding: '24px 28px', borderRadius: 18 }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 28, color: 'var(--text-primary)', marginBottom: 16 }}>
                  Open Lending Offers
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {offersLoading && <div style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)' }}>Loading offers...</div>}
                  {(offersData?.offers ?? []).map((offer) => (
                    <div key={offer.offer_id} className="glass" style={{ padding: '14px 16px', borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--accent)' }}>
                          {offer.ens_name}
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-primary)' }}>
                          {offer.rate_pct}%
                        </div>
                      </div>
                      <div style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-secondary)' }}>
                        max ${offer.max_amount_usdc} | min rep {offer.min_rep_required}
                      </div>
                    </div>
                  ))}
                </div>

                {borrowerAgent && UUID_REGEX.test(borrowerAgent.agent_id) && (
                  <div className="glass" style={{ padding: '18px 16px', borderRadius: 12, marginTop: 16 }}>
                    <div className="label-ui" style={{ marginBottom: 10 }}>Borrow as {borrowerAgent.ens_name}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        value={borrowAmount}
                        onChange={(e) => setBorrowAmount(e.target.value)}
                        style={{ width: 120, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)' }}
                      />
                      <button
                        className="btn btn-ghost"
                        style={{ height: 36, padding: '0 14px', fontSize: 12 }}
                        onClick={async () => {
                          try {
                            setBorrowQuote(await api.getBorrowQuote(borrowerAgent.agent_id, Number(borrowAmount)));
                          } catch {
                            setBorrowQuote(null);
                          }
                        }}
                      >
                        Get quote
                      </button>
                      {borrowQuote && (
                        <button
                          className="btn btn-primary glow-accent"
                          style={{ height: 36, padding: '0 16px', fontSize: 12 }}
                          onClick={() => requestBorrowMutation.mutate({ borrowerAgentId: borrowerAgent.agent_id, requestedAmountUsdc: Number(borrowAmount) })}
                        >
                          Request borrow
                        </button>
                      )}
                    </div>
                    {borrowQuote && (
                      <div style={{ marginTop: 12, fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Total owed ${borrowQuote.totalOwedUsdc.toFixed(2)} | collateral ${borrowQuote.collateralUsdc.toFixed(2)} | rate {borrowQuote.ratePct}%
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="glass" style={{ padding: '24px 28px', borderRadius: 18 }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 28, color: 'var(--text-primary)', marginBottom: 16 }}>
                  Registered Tools
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(adminOverview?.tools ?? []).map((tool) => (
                    <span key={String(tool.name)} className="badge badge-active">
                      {String(tool.name)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailPanel
            agent={selectedAgent}
            backendAgentId={UUID_REGEX.test(selectedAgent.id) ? selectedAgent.id : createdAgentId || undefined}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
