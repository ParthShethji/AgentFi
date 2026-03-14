import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Vault, FileText, Zap } from 'lucide-react';
import ThreeGlobe from '../components/Globe';
import AmbientBackground from '../components/AmbientBackground';
import { useApp } from '../context/AppContext';

const TICKER_ITEMS = [
  '⬤ $2.4M total capital deployed',
  '⬤ 247 active agents',
  '⬤ 1,842 loans issued',
  '⬤ $18,400 yield earned this week',
  '⬤ 99.2% repayment rate',
];

const STEPS = [
  {
    icon: <Vault size={40} color="var(--accent)" />,
    title: 'Deposit Capital',
    desc: 'Fund your agent\'s BitGo MPC vault. Institutional-grade multi-sig security. Your keys never leave your custody.',
    number: '01',
  },
  {
    icon: <FileText size={40} color="var(--accent)" />,
    title: 'Write Your Strategy',
    desc: 'Define risk rules in a Fileverse encrypted doc. Stop-loss thresholds, loan limits, yield targets. Private. Owned entirely by you.',
    number: '02',
  },
  {
    icon: <Zap size={40} color="var(--accent)" />,
    title: 'Agent Goes to Work',
    desc: 'Your agent lends idle capital, borrows to trade, and repays autonomously. You receive yield. Nothing is exposed on-chain.',
    number: '03',
  },
];

// Repeat 3x for infinite ticker loop
const tickerContent = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];

export default function LandingPage() {
  const { setCurrentView } = useApp();
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AmbientBackground />

      {/* ── Hero (100vh) ── */}
      <section style={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Globe */}
        <ThreeGlobe />

        {/* Hero copy — centered over globe */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={heroLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: 640,
            padding: '48px 48px',
          }}
          className="glass-elevated"
        >
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(56px, 8vw, 88px)',
            fontWeight: 300,
            letterSpacing: '-2px',
            lineHeight: 0.95,
            color: 'var(--text-primary)',
          }}>
            The Agent<br />Economy
          </h1>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            marginTop: 20,
            lineHeight: 1.7,
            maxWidth: 480,
          }}>
            Spin up an agent. Write your strategy privately.
            Let it lend, borrow, and trade — autonomously.
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 40, width: '100%', justifyContent: 'center' }}>
            <button
              className="btn btn-primary glow-accent"
              onClick={() => setCurrentView('onboarding')}
              id="launch-agent-btn"
            >
              Launch Your Agent →
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
              id="watch-work-btn"
            >
              Watch it work ↓
            </button>
          </div>

          {/* Live counter */}
          <div className="agents-count" style={{ marginTop: 20 }}>
            <span className="pulse-dot" />
            <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>247</span> agents active across the network
            </span>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <div
          className="scroll-indicator"
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        >
          <div className="scroll-line" />
          <span style={{
            fontFamily: 'Inter',
            fontSize: 10,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>
            scroll
          </span>
        </div>
      </section>

      {/* ── Stats Ticker ── */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="ticker-wrap" style={{ width: '100%' }}>
          <div className="ticker-track">
            {tickerContent.map((item, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                paddingRight: 48,
                fontFamily: 'Inter',
                fontSize: 13,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}>
                {item.startsWith('⬤') ? (
                  <>
                    <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                    <span dangerouslySetInnerHTML={{ __html: item.replace('⬤ ', '').replace(/(\$[\d,]+\.?\d*|\d[\d,]+\.?\d*%?)/g, '<span style="font-family:JetBrains Mono;color:var(--text-primary)">$1</span>') }} />
                  </>
                ) : item}
                <span style={{ marginLeft: 24, color: 'var(--text-tertiary)' }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── How It Works ── */}
      <section
        id="how-it-works"
        style={{ padding: '120px 0', position: 'relative', zIndex: 2 }}
      >
        <div className="section-container">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p className="label-ui" style={{ marginBottom: 16 }}>HOW IT WORKS</p>
            <h2 style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 'clamp(36px, 5vw, 52px)',
              fontWeight: 300,
              color: 'var(--text-primary)',
            }}>
              Three steps to autonomous finance.
            </h2>
          </div>

          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                className="glass"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: 'easeOut' }}
                whileHover={{ y: -4 }}
                style={{ padding: '40px 32px', position: 'relative', overflow: 'hidden' }}
              >
                {/* Decorative number */}
                <div style={{
                  position: 'absolute',
                  top: -10,
                  right: 20,
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 80,
                  fontWeight: 200,
                  color: 'rgba(16,185,129,0.08)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}>
                  {step.number}
                </div>

                <div style={{ marginBottom: 24 }}>{step.icon}</div>
                <h3 style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 26,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  marginBottom: 12,
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section style={{ padding: '80px 0 120px', position: 'relative', zIndex: 2 }}>
        <div className="section-container" style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="label-ui" style={{ marginBottom: 20 }}>READY TO START?</p>
            <h2 style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 'clamp(40px, 6vw, 64px)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              marginBottom: 16,
              letterSpacing: '-1px',
            }}>
              Your capital deserves<br />an intelligence.
            </h2>
            <p style={{
              fontFamily: 'Inter',
              fontSize: 16,
              color: 'var(--text-secondary)',
              marginBottom: 40,
              lineHeight: 1.7,
            }}>
              Deploy your first agent in under 5 minutes.
            </p>
            <button
              className="btn btn-primary glow-accent"
              style={{ height: 56, padding: '0 48px', fontSize: 16 }}
              onClick={() => setCurrentView('onboarding')}
              id="footer-launch-btn"
            >
              Launch Your Agent →
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
