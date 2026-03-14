import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, TrendingUp, BarChart2, Layers, Check, ArrowLeft } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import { useApp } from '../context/AppContext';

const STEP_LABELS = ['Connect', 'Name Agent', 'Choose Role', 'Strategy', 'Verify', 'Launch'];

const LENDER_STRATEGY = `Only lend to agents with reputation above 80.
Maximum single loan: 500 USDC.
Maximum concurrent loans: 3.
Minimum interest rate: 2%.`;

const TRADER_STRATEGY = `Borrow maximum 800 USDC per opportunity.
Stop-loss at 5%. Take-profit at 12%.
Only trade on Base network.
Preferred assets: USDC, ETH, cbBTC.`;

const BOTH_STRATEGY = `Only lend to agents with reputation above 80.
Maximum single loan: 500 USDC.
Maximum concurrent loans: 3.
Minimum interest rate: 2%.

Borrow maximum 800 USDC per opportunity.
Stop-loss at 5%. Take-profit at 12%.
Only trade on Base network.
Preferred assets: USDC, ETH, cbBTC.`;

type Role = 'Lender' | 'Trader' | 'Both';

const variants = {
  enter: (dir: number) => ({ y: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function OnboardingPage() {
  const { setCurrentView, onboardingStep: step, setOnboardingStep: setStep } = useApp();
  const [dir, setDir] = useState(1);
  const [agentName, setAgentName] = useState('vault-alpha');
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(true);
  const [role, setRole] = useState<Role>('Both');
  const [strategy, setStrategy] = useState(BOTH_STRATEGY);
  const [walletConnected, setWalletConnected] = useState(false);

  // Update strategy when role changes
  useEffect(() => {
    if (role === 'Lender') setStrategy(LENDER_STRATEGY);
    else if (role === 'Trader') setStrategy(TRADER_STRATEGY);
    else setStrategy(BOTH_STRATEGY);
  }, [role]);

  // Debounced ENS check
  useEffect(() => {
    if (step !== 1) return;
    setNameAvailable(null);
    const t = setTimeout(() => {
      // Mock: taken if name is exactly "vault-alpha-taken"
      setNameAvailable(agentName !== 'vault-alpha-taken' && agentName.length > 2);
    }, 400);
    return () => clearTimeout(t);
  }, [agentName, step]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && step < 5) advance();
      if (e.key === 'Escape' && step > 0) back();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step]);

  const advance = useCallback(() => {
    setDir(1);
    setStep(Math.min(step + 1, 5));
  }, [step]);

  const back = useCallback(() => {
    setDir(-1);
    setStep(Math.max(step - 1, 0));
  }, [step]);

  const jumpTo = (s: number) => {
    if (s < step) { setDir(-1); setStep(s); }
  };

  const progress = ((step + 1) / 6) * 100;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AmbientBackground />

      {/* Right-side step navigator */}
      <div className="step-nav">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="step-nav-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                className={`step-nav-circle ${i === step ? 'active' : i < step ? 'completed' : ''}`}
                onClick={() => jumpTo(i)}
                style={{ background: 'none', border: 'none', cursor: i < step ? 'pointer' : 'default', padding: 0 }}
              >
                {i < step && <Check size={6} color="#030712" />}
              </button>
              <span className={`step-nav-label ${i === step ? 'active' : ''}`} style={{ position: 'absolute', right: 16 }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`step-connector ${i < step ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="glass-elevated" style={{
        width: '100%',
        maxWidth: 600,
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden',
        minHeight: 520,
        margin: '0 20px',
      }}>
        {/* Progress bar */}
        <div className="progress-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 0 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Back button */}
        {step > 0 && step < 5 && (
          <button
            onClick={back}
            style={{
              position: 'absolute', top: 20, left: 20,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: 'Inter', fontSize: 13,
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}

        <div style={{ padding: '52px 48px 44px' }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: step === 5 ? 0.5 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ── Step 0: Connect ── */}
              {step === 0 && (
                <div>
                  <p className="label-ui">STEP 1 OF 6</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    Connect your wallet.
                  </h2>
                  <p style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.7 }}>
                    Your keys. Your agents. Your capital.
                  </p>
                  <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      className="btn btn-primary btn-full glow-accent"
                      onClick={() => { setWalletConnected(true); advance(); }}
                      id="connect-metamask-btn"
                    >
                      <span>🦊</span> Connect with MetaMask
                    </button>
                    <button
                      className="btn btn-ghost btn-full"
                      onClick={() => { setWalletConnected(true); advance(); }}
                      id="connect-walletconnect-btn"
                    >
                      <span>🔗</span> WalletConnect
                    </button>
                  </div>
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 20 }}>
                    We never custody your funds.
                  </p>
                </div>
              )}

              {/* ── Step 1: Name Agent ── */}
              {step === 1 && (
                <div>
                  <p className="label-ui">STEP 2 OF 6</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    Name your agent.
                  </h2>
                  <div style={{ marginTop: 40, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                      <input
                        className="input-field"
                        value={agentName}
                        onChange={e => setAgentName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        style={{ fontFamily: 'Cormorant Garamond', fontSize: 36, fontWeight: 300, flex: 1, border: 'none', paddingBottom: 0 }}
                        id="agent-name-input"
                        autoFocus
                      />
                      <span style={{ fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: 300, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        .agentfi.eth
                      </span>
                    </div>
                    <div style={{ marginTop: 16, fontFamily: 'Inter', fontSize: 13 }}>
                      {nameAvailable === null && <span style={{ color: 'var(--text-secondary)' }}>⏳ Checking availability...</span>}
                      {nameAvailable === true && <span style={{ color: 'var(--success)' }}>🟢 {agentName}.agentfi.eth is available</span>}
                      {nameAvailable === false && <span style={{ color: 'var(--danger)' }}>🔴 Taken — try {agentName}-2 or {agentName}-prime</span>}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary glow-accent"
                    style={{ marginTop: 40, height: 52, padding: '0 32px' }}
                    onClick={advance}
                    disabled={!nameAvailable}
                    id="name-continue-btn"
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* ── Step 2: Choose Role ── */}
              {step === 2 && (
                <div>
                  <p className="label-ui">STEP 3 OF 6</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    What will your agent do?
                  </h2>
                  <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                    {([
                      { r: 'Lender' as Role, icon: <TrendingUp size={24} color="var(--accent)" />, line: 'Earn yield. Offer capital to trusted agents.' },
                      { r: 'Trader' as Role, icon: <BarChart2 size={24} color="var(--warning)" />, line: 'Borrow capital. Execute strategies. Repay with profit.' },
                      { r: 'Both' as Role, icon: <Layers size={24} color="#60A5FA" />, line: 'Lend idle funds while trading with borrowed capital.' },
                    ] as { r: Role; icon: React.ReactNode; line: string }[]).map(({ r, icon, line }) => (
                      <button
                        key={r}
                        className={`glass role-card ${role === r ? 'selected' : ''}`}
                        onClick={() => {
                          setRole(r);
                          setTimeout(advance, 500);
                        }}
                        id={`role-${r.toLowerCase()}-btn`}
                        style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ marginBottom: 12 }}>{icon}</div>
                        <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 20, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 8 }}>{r}</div>
                        <div style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{line}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 3: Strategy ── */}
              {step === 3 && (
                <div>
                  <p className="label-ui">STEP 4 OF 6</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    Define your risk rules.
                  </h2>
                  <div className="glass" style={{ marginTop: 28, padding: 20, borderRadius: 12 }}>
                    <textarea
                      className="textarea-field"
                      value={strategy}
                      onChange={e => setStrategy(e.target.value)}
                      rows={10}
                      style={{ height: 220, overflowY: 'auto', width: '100%' }}
                      id="strategy-textarea"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <span>🔒</span>
                    <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-secondary)' }}>
                      Encrypted in your Fileverse vault. Only your agent can read this.
                    </span>
                  </div>
                  <button
                    className="btn btn-primary glow-accent"
                    style={{ marginTop: 28, height: 52, padding: '0 32px' }}
                    onClick={advance}
                    id="strategy-continue-btn"
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* ── Step 4: Verify / Bootstrap Credit ── */}
              {step === 4 && (
                <BootstrapStep advance={advance} />
              )}

              {/* ── Step 5: Launch ── */}
              {step === 5 && (
                <LaunchStep agentName={agentName} setCurrentView={setCurrentView} setStep={setStep} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Bootstrap Step ──────────────────────────────────────────────────────────
function BootstrapStep({ advance }: { advance: () => void }) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const pct = Math.min((now - start) / 800, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setScore(Math.round(40 * eased));
      if (pct < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  return (
    <div>
      <p className="label-ui">STEP 5 OF 6</p>
      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
        Unlock borrowing.
      </h2>
      <p style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.7 }}>
        Prove your identity once with a ZK proof.<br />
        Borrow capital without posting collateral.
      </p>

      {/* Tier preview */}
      <div className="glass" style={{ marginTop: 28, padding: '20px 24px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Current Score</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 28, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>0</div>
        </div>
        <span style={{ color: 'var(--accent)', fontSize: 24 }}>→</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>After Verification</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 28, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{score} / 100</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="badge badge-active" style={{ marginBottom: 4 }}>NEW</div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-secondary)' }}>Max borrow: <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>$500 USDC</span></div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-full glow-accent"
        style={{ marginTop: 24 }}
        onClick={advance}
        id="verify-btn"
      >
        <Shield size={16} /> Verify with Reclaim Protocol
      </button>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={advance}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, color: 'var(--text-tertiary)' }}
          id="skip-verify-btn"
        >
          Skip for now — I'm only lending
        </button>
      </div>
    </div>
  );
}

// ── Launch Step ──────────────────────────────────────────────────────────────
function LaunchStep({ agentName, setCurrentView, setStep }: { agentName: string; setCurrentView: (v: any) => void; setStep: (s: number) => void }) {
  const [drawDone, setDrawDone] = useState(false);
  const [pulseDone, setPulseDone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setDrawDone(true), 1000);
    const t2 = setTimeout(() => setPulseDone(true), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Animated checkmark */}
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <defs>
            <style>{`
              @keyframes drawCircle {
                from { stroke-dashoffset: 220; }
                to { stroke-dashoffset: 0; }
              }
              @keyframes drawCheck {
                from { stroke-dashoffset: 60; }
                to { stroke-dashoffset: 0; }
              }
              @keyframes pulseRing {
                from { transform-origin: 40px 40px; transform: scale(1); opacity: 1; }
                to { transform-origin: 40px 40px; transform: scale(1.8); opacity: 0; }
              }
            `}</style>
          </defs>
          {pulseDone && (
            <circle cx="40" cy="40" r="36" fill="none" stroke="var(--accent)" strokeWidth="1.5"
              style={{ animation: 'pulseRing 0.6s ease-out forwards', transformBox: 'fill-box' }} />
          )}
          <circle cx="40" cy="40" r="35" fill="none" stroke="var(--accent)" strokeWidth="2.5"
            strokeDasharray="220" style={{ animation: 'drawCircle 0.6s ease-out forwards' }} />
          <polyline points="24,42 35,53 57,30" fill="none" stroke="var(--accent)" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="60" style={{ animation: 'drawCheck 0.3s ease-out 0.7s forwards', strokeDashoffset: 60 }} />
        </svg>
      </div>

      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 300, marginTop: 32, color: 'var(--text-primary)', lineHeight: 1 }}>
        Your agent is live.
      </h2>
      <p style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.7 }}>
        <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>{agentName}.agentfi.eth</span> is active<br />
        and monitoring the network.
      </p>

      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          className="btn btn-primary btn-full glow-accent"
          onClick={() => setCurrentView('dashboard')}
          id="view-dashboard-btn"
        >
          View Dashboard →
        </button>
        <button
          className="btn btn-ghost btn-full"
          onClick={() => { setStep(0); }}
          id="launch-another-btn"
        >
          Launch another agent
        </button>
      </div>
    </div>
  );
}
