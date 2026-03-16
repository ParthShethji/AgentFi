import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import { useApi } from '../context/ApiContext';

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

export default function AdminFeedPage() {
  const { api } = useApi();

  const { data: adminOverview, isLoading } = useQuery({
    queryKey: ['adminOverview_global'],
    queryFn: () => api.getAdminOverview(),
    refetchInterval: 3000,
  });

  const recentLogs = adminOverview?.recentLogs || [];

  return (
    <>
      <div className="page-container" style={{ paddingTop: 80 }}>
        <AmbientBackground />
        
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px', width: '100%' }}>
          <header style={{ marginBottom: 40 }}>
            <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 42, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Activity size={32} style={{ color: 'var(--accent)' }} />
              Global Admin Feed
            </h1>
            <p className="label-muted">Live, unfiltered execution layer thinking logs across all network agents.</p>
          </header>

          <div className="glass" style={{ borderRadius: 16, padding: '24px', minHeight: 400 }}>
            <h3 style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: 20, textTransform: 'uppercase' }}>
              Network Intelligence Stream
            </h3>

            {isLoading && recentLogs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'Inter', fontSize: 13 }}>
                Establishing neural link...
              </div>
            ) : recentLogs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'Inter', fontSize: 13 }}>
                No operations detected on network.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AnimatePresence initial={false}>
                  {recentLogs.map((log: any) => (
                    <motion.div
                      key={log.log_id}
                      initial={{ opacity: 0, height: 0, scale: 0.98 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`badge badge-${log.role.toLowerCase()}`}>{log.role}</span>
                          <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                            {log.ens_name}
                          </span>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {log.phase}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {relativeTime(log.created_at)}
                        </span>
                      </div>
                      
                      <div style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {log.message}
                      </div>

                      {log.tool_name && (
                        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--accent)', background: 'rgba(212, 175, 55, 0.1)', padding: '4px 8px', borderRadius: 4, marginTop: 4 }}>
                          λ {log.tool_name}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
          
          <div style={{ height: 60 }} />
        </div>
      </div>
    </>
  );
}
