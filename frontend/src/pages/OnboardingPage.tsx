import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, Check, ArrowLeft } from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import { useApp } from '../context/AppContext';
import { useApi } from '../context/ApiContext';
import { resolveEns } from '../api';
import { connectMetaMask, formatAddress, getEthereumProvider } from '../wallet/metamask';

const STEP_LABELS = ['Connect', 'Verify ENS', 'ZK Proof'];

const DEFAULT_EMAIL = 'user@agentfi.demo';

const variants = {
  enter: (dir: number) => ({ y: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { api, baseUrl } = useApi();
  const {
    onboardingStep: step, setOnboardingStep: setStep,
    userId, setUserId,
    walletAddress, setWalletAddress,
    walletChainId, setWalletChainId,
    walletConnected, setWalletConnected,
    verifiedEnsName, setVerifiedEnsName,
    zkVerified, setZkVerified,
  } = useApp();

  const [dir, setDir] = useState(1);
  const [ensName, setEnsName] = useState(verifiedEnsName || '');
  const [ensValid, setEnsValid] = useState<boolean | null>(null);
  const [ensOwnershipChecked, setEnsOwnershipChecked] = useState(false);
  const [ensOwnershipError, setEnsOwnershipError] = useState<string | null>(null);
  const [ensVerifying, setEnsVerifying] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // 🐛 DEBUG: raw address returned by ENS resolver
  const [ensResolvedAddress, setEnsResolvedAddress] = useState<string | null>(null);

  // When arriving from create-agent with ?step=0|1|2, open that onboarding step
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam !== null) {
      const n = parseInt(stepParam, 10);
      if (n >= 0 && n <= 2) setStep(n);
    }
  }, [searchParams, setStep]);

  // If wallet is connected and already fully verified, redirect to create-agent (avoid loop when wallet was cleared on load)
  useEffect(() => {
    if (walletAddress && zkVerified && verifiedEnsName && userId) {
      navigate('/create-agent', { replace: true });
    }
  }, [walletAddress, zkVerified, verifiedEnsName, userId, navigate]);

  // Debounced ENS format validation
  useEffect(() => {
    if (step !== 1) return;
    if (!ensName || !ensName.includes('.')) {
      setEnsValid(null);
      setEnsOwnershipChecked(false);
      return;
    }
    setEnsValid(null);
    setEnsOwnershipChecked(false);
    const t = setTimeout(() => {
      const isValid = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(ensName);
      setEnsValid(isValid && ensName.length > 4);
    }, 400);
    return () => clearTimeout(t);
  }, [ensName, step]);

  const advance = useCallback(() => {
    setDir(1);
    setStep(Math.min(step + 1, 2));
  }, [step, setStep]);

  const back = useCallback(() => {
    setDir(-1);
    setStep(Math.max(step - 1, 0));
  }, [step, setStep]);

  const jumpTo = (s: number) => {
    if (s < step) { setDir(-1); setStep(s); }
  };

  const handleVerifyOwnership = async () => {
    setEnsOwnershipError(null);
    setEnsResolvedAddress(null);
    if (!walletAddress) {
      setEnsOwnershipError('The ENS name does not belong to the user.');
      return;
    }
    setEnsVerifying(true);
    try {
      const { address } = await resolveEns(baseUrl, ensName);
      // 🐛 DEBUG: store raw resolved address for display
      setEnsResolvedAddress(address);
      console.debug('[ENS DEBUG] resolveEns result:', { ensName, address, walletAddress });
      if (address == null || address.toLowerCase() !== walletAddress.toLowerCase()) {
        setEnsOwnershipError('The ENS name does not belong to the user.');
        return;
      }
      setEnsOwnershipChecked(true);
      setVerifiedEnsName(ensName);
      setTimeout(advance, 600);
    } catch (err) {
      console.debug('[ENS DEBUG] resolveEns threw:', err);
      setEnsOwnershipError('The ENS name does not belong to the user.');
    } finally {
      setEnsVerifying(false);
    }
  };

  const handleZkVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    // Mock ZK verification — simulates ~1.5s proof generation
    await new Promise(r => setTimeout(r, 1500));
    setZkVerified(true);

    // Create the user account with ZK proof data
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const userRes = await api.createUser({
          email: DEFAULT_EMAIL,
          walletAddress: walletAddress || undefined,
          zkProofData: walletAddress || 'mock-zk-proof',
        });
        currentUserId = userRes.userId;
        setUserId(currentUserId);
      }
      setVerifying(false);
    } catch (err) {
      setVerifying(false);
      setVerifyError(err instanceof Error ? err.message : 'Failed to create user');
      setZkVerified(false);
    }
  };

  const progress = ((step + 1) / 3) * 100;

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
        minHeight: 480,
        margin: '0 20px',
      }}>
        {/* Progress bar */}
        <div className="progress-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: 0 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Back button */}
        {step > 0 && (
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
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ── Step 0: Connect Wallet ── */}
              {step === 0 && (
                <div>
                  <p className="label-ui">STEP 1 OF 3</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    Connect your wallet.
                  </h2>
                  <p style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.7 }}>
                    Your keys. Your agents. Your capital.
                  </p>
                  <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      className="btn btn-primary btn-full glow-accent"
                      onClick={async () => {
                        setConnectError(null);
                        try {
                          const res = await connectMetaMask();
                          setWalletAddress(res.address);
                          setWalletChainId(res.chainId);
                          setWalletConnected(true);
                          advance();
                        } catch (e) {
                          setConnectError(e instanceof Error ? e.message : 'Failed to connect wallet');
                        }
                      }}
                      id="connect-metamask-btn"
                    >
                      <span>🦊</span> {walletAddress ? `Connected: ${formatAddress(walletAddress)}` : 'Connect with MetaMask'}
                    </button>
                    <button className="btn btn-ghost btn-full" disabled id="connect-walletconnect-btn">
                      <span>🔗</span> WalletConnect
                    </button>
                  </div>
                  {connectError && (
                    <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginTop: 14 }}>
                      {connectError}
                    </p>
                  )}
                  {!getEthereumProvider() && (
                    <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 14 }}>
                      MetaMask not detected. Install it to continue.
                    </p>
                  )}
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 20 }}>
                    We never custody your funds.
                  </p>
                </div>
              )}

              {/* ── Step 1: ENS Name + Ownership Verification ── */}
              {step === 1 && (
                <div>
                  <p className="label-ui">STEP 2 OF 3</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    Verify your ENS.
                  </h2>
                  <p style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                    Enter the ENS name you own. We'll verify it resolves to your connected wallet.
                    Your agents will be created as subdomains of this name.
                  </p>
                  <div style={{ marginTop: 28, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                      <input
                        className="input-field"
                        value={ensName}
                        onChange={e => {
                          setEnsName(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''));
                          setEnsOwnershipChecked(false);
                          setEnsOwnershipError(null);
                        }}
                        placeholder="yourname.eth"
                        style={{ fontFamily: 'Cormorant Garamond', fontSize: 36, fontWeight: 300, flex: 1, border: 'none', paddingBottom: 0 }}
                        id="ens-name-input"
                        autoFocus
                      />
                    </div>
                    <div style={{ marginTop: 16, fontFamily: 'Inter', fontSize: 13 }}>
                      {!ensName && <span style={{ color: 'var(--text-tertiary)' }}>Enter your ENS name (e.g. alice.eth)</span>}
                      {ensName && ensValid === null && <span style={{ color: 'var(--text-secondary)' }}>⏳ Validating...</span>}
                      {ensValid === true && !ensOwnershipChecked && (
                        <span style={{ color: 'var(--text-secondary)' }}>🟢 Valid format — click below to verify ownership</span>
                      )}
                      {ensValid === true && ensOwnershipChecked && (
                        <span style={{ color: 'var(--success)' }}>✅ {ensName} verified — belongs to {formatAddress(walletAddress || '')}</span>
                      )}
                      {ensName && ensValid === false && <span style={{ color: 'var(--danger)' }}>🔴 Invalid ENS format — must end in .eth</span>}
                    </div>
                    {walletAddress && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Connected: {walletAddress}
                      </div>
                    )}

                    {/* 🐛 DEBUG PANEL — remove before prod */}
                    {ensResolvedAddress !== null && (
                      <div style={{
                        marginTop: 10,
                        padding: '10px 14px',
                        background: 'rgba(251,191,36,0.07)',
                        border: '1px solid rgba(251,191,36,0.25)',
                        borderRadius: 8,
                        fontFamily: 'JetBrains Mono',
                        fontSize: 11,
                        lineHeight: 1.7,
                      }}>
                        <div style={{ color: 'rgba(251,191,36,0.7)', letterSpacing: '0.08em', marginBottom: 4 }}>🐛 ENS DEBUG</div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ </span><span style={{ color: '#fbbf24' }}>{ensName}</span></div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>resolved → </span><span style={{ color: ensResolvedAddress ? '#4ade80' : '#f87171' }}>{ensResolvedAddress ?? 'null (not found)'}</span></div>
                        <div><span style={{ color: 'var(--text-tertiary)' }}>wallet&nbsp;&nbsp; → </span><span style={{ color: 'var(--text-secondary)' }}>{walletAddress}</span></div>
                        <div style={{ marginTop: 4 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>match&nbsp;&nbsp;&nbsp; → </span>
                          <span style={{ color: ensResolvedAddress?.toLowerCase() === walletAddress?.toLowerCase() ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                            {ensResolvedAddress?.toLowerCase() === walletAddress?.toLowerCase() ? '✅ YES' : '❌ NO'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {ensOwnershipError && (
                    <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--danger)', marginTop: 16 }}>
                      {ensOwnershipError}
                    </p>
                  )}
                  {!ensOwnershipChecked ? (
                    <button
                      className="btn btn-primary glow-accent"
                      style={{ marginTop: 32, height: 52, padding: '0 32px' }}
                      onClick={handleVerifyOwnership}
                      disabled={!ensValid || ensVerifying}
                      id="verify-ownership-btn"
                    >
                      {ensVerifying ? 'Verifying...' : 'Verify ENS Ownership →'}
                    </button>
                  ) : (
                    <div style={{ marginTop: 16, fontFamily: 'Inter', fontSize: 13, color: 'var(--success)', textAlign: 'center' }}>
                      Ownership verified. Advancing...
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: ZK Human Verification ── */}
              {step === 2 && (
                <div>
                  <p className="label-ui">STEP 3 OF 3</p>
                  <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 'clamp(40px, 6vw, 52px)', fontWeight: 300, marginTop: 12, color: 'var(--text-primary)' }}>
                    Prove you're human.
                  </h2>
                  <p style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.7 }}>
                    One-time ZK identity verification via Reclaim Protocol.<br />
                    This maps your ENS to a unique human — preventing sybil attacks.
                  </p>

                  <div className="glass" style={{ marginTop: 28, padding: '20px 24px', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Your Identity</div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, color: 'var(--accent)' }}>{verifiedEnsName}</div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{walletAddress ? formatAddress(walletAddress) : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="badge badge-active" style={{ marginBottom: 4 }}>{zkVerified ? 'VERIFIED' : 'REQUIRED'}</div>
                      </div>
                    </div>
                  </div>

                  {verifyError && (
                    <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--danger)', marginTop: 16, textAlign: 'center' }}>
                      {verifyError}
                    </p>
                  )}

                  {!zkVerified ? (
                    <button
                      className="btn btn-primary btn-full glow-accent"
                      style={{ marginTop: 24 }}
                      onClick={handleZkVerify}
                      disabled={verifying}
                      id="verify-btn"
                    >
                      <Shield size={16} /> {verifying ? 'Verifying identity...' : 'Verify with Reclaim Protocol'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-full glow-accent"
                      style={{ marginTop: 24 }}
                      onClick={() => navigate('/create-agent')}
                      id="continue-to-agents-btn"
                    >
                      <Shield size={16} /> Identity verified — Create your first agent →
                    </button>
                  )}
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 16 }}>
                    ZK proof ensures one human per ENS. Your data stays private.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
