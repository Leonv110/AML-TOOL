import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, BarChart3, Search, Database, ChevronRight, Lock, Globe, Activity, Mail, Linkedin, Twitter, MapPin, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import './LandingPage.css';

// Default content (fallback if JSON fails to load)
const DEFAULTS = {
  hero: { badge: 'Next-Gen Forensic Intelligence', title: 'Forensic Intelligence', titleAccent: 'Reimagined', subtitle: 'The Global Association of Forensic Accountants (GAFA) provides elite Anti-Money Laundering tools driven by advanced ML ensembles and real-time transaction monitoring.', primaryCta: 'Get Started Now', secondaryCta: 'Join CAML', secondaryCtaLink: 'https://www.gafa.org.in' },
  about: { title: 'About GAFA AML', paragraphs: ['The Global Association of Forensic Accountants (GAFA) has designed this flagship Anti-Money Laundering (AML) platform to bridge the gap between theoretical forensic accounting and practical, AI-driven threat detection.', 'Built specifically for certified Anti Money Laundering Professionals, Compliance officers and forensic accounting professionals, GAFA AML platform leverages Technology integration in Anti money laundering. The AI agents are used to analyze complex transaction networks, identifying layering and smurfing techniques that traditional rule sets fail to capture.'], stats: [{ number: '30+', label: 'Real-World AML Case Studies' }, { number: '20+', label: 'Practical Monitoring Assignments' }, { number: '5+', label: 'Global AML Frameworks (FATF, RBI, EU AMLD)' }], securityTitle: 'Bank-grade Security', securitySubtitle: 'E2E Encrypted Forensic Ledgers' },
  features: { title: 'Core Capabilities', subtitle: 'Enterprise-grade tools for modern AML', items: [{ icon: 'Search', title: 'Advanced ML Detection', description: 'Advanced anomaly detection with AI to identify suspicious patterns that traditional rule-based systems miss.' }, { icon: 'BarChart3', title: 'Real-time Analytics', description: 'Visualize complex transaction webs and identify layered money movements instantly.' }, { icon: 'Lock', title: 'Regulatory Compliance', description: 'Built to align with global AML/CFT requirements and reporting standards.' }] },
  trust: { title: 'Global Standards. Local Precision.', description: 'GAFA engages with partner networks collectively handling significant transaction volumes, supporting transparency and stronger financial oversight practices.' },
  faq: { title: 'Frequently Asked Questions', subtitle: 'Everything you need to know about the GAFA platform.', items: [{ question: 'Who is this platform designed for?', answer: "It is built for students and professionals enrolled in GAFA's CAML program, especially those in banking, compliance, audit, and financial investigation roles." }, { question: 'How does the detection work?', answer: 'The platform combines rule-based scenarios with basic machine learning models to simulate real transaction monitoring, helping learners identify suspicious patterns and risk indicators.' }, { question: 'Is the data secure?', answer: 'Yes. The platform uses simulated and anonymized data with strong security controls, ensuring a safe training environment without real customer exposure.' }, { question: 'Can learners practice on the platform?', answer: 'Yes. A sandbox environment allows users to analyze mock transactions, generate alerts, and perform investigations in a risk-free setting.' }] },
  footer: { brandDescription: 'Advancing forensic financial analysis through intelligent monitoring, real-time risk detection, and globally aligned compliance standards.', email: 'info@gafa.org.in', website: 'www.gafa.org.in', copyright: 'Global Association of Forensic Accountants' },
};

const ICON_MAP = { Search, BarChart3, Database, Lock };

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [content, setContent] = useState(DEFAULTS);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load editable content from JSON (team can edit public/landing-content.json)
  useEffect(() => {
    fetch('/landing-content.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setContent(prev => ({ ...prev, ...data })); })
      .catch(() => { /* silently use defaults */ });
  }, []);

  const c = content;

  return (
    <div className="landing-wrapper">
      <div className="liquid-bg" />
      <div className="liquid-blob" style={{ top: '10%', left: '10%' }} />
      <div className="liquid-blob" style={{ bottom: '10%', right: '10%', background: 'rgba(79, 172, 254, 0.2)' }} />

      {/* Navigation */}
      <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-logo">
            <img src="/logo.webp" alt="GAFA" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span className="logo-text">GAFA AML</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#compliance">Compliance</a>
            <Link to="/login" className="gafa-btn gafa-btn-primary">
              Access Platform <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-grid">
          <div className="hero-content">
            <div className="hero-badge">
              <Activity size={14} className="pulse" />
              <span>{c.hero?.badge || DEFAULTS.hero.badge}</span>
            </div>
            <h1 className="hero-title text-gradient">
              {c.hero?.title || DEFAULTS.hero.title} <br />
              <span className="accent-gradient">{c.hero?.titleAccent || DEFAULTS.hero.titleAccent}</span>
            </h1>
            <p className="hero-subtitle">
              {c.hero?.subtitle || DEFAULTS.hero.subtitle}
            </p>
            <div className="hero-actions">
              <button onClick={() => navigate('/login')} className="gafa-btn gafa-btn-primary">
                {c.hero?.primaryCta || DEFAULTS.hero.primaryCta} <ChevronRight size={18} />
              </button>
              <a href={c.hero?.secondaryCtaLink || DEFAULTS.hero.secondaryCtaLink} target="_blank" rel="noopener noreferrer" className="gafa-btn glass-card">
                {c.hero?.secondaryCta || DEFAULTS.hero.secondaryCta}
              </a>
            </div>
          </div>
          
          <div className="hero-visual">
            <NetworkAnimation />
          </div>
        </div>
      </header>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-container glass-panel">
          <div className="about-content">
            <h2 className="text-gradient">{c.about?.title || DEFAULTS.about.title}</h2>
            {(c.about?.paragraphs || DEFAULTS.about.paragraphs).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="about-stats">
              {(c.about?.stats || DEFAULTS.about.stats).map((stat, i) => (
                <div className="stat-item" key={i}>
                  <span className="stat-number">{stat.number}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="about-visual">
             <div className="glass-card compliance-badge">
                <Shield size={64} className="accent-gradient pulse" />
                <h3>{c.about?.securityTitle || DEFAULTS.about.securityTitle}</h3>
                <p>{c.about?.securitySubtitle || DEFAULTS.about.securitySubtitle}</p>
             </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="text-gradient">{c.features?.title || DEFAULTS.features.title}</h2>
          <p>{c.features?.subtitle || DEFAULTS.features.subtitle}</p>
        </div>
        <div className="features-grid">
          {(c.features?.items || DEFAULTS.features.items).map((feat, i) => {
            const IconComp = ICON_MAP[feat.icon] || Search;
            return (
              <FeatureCard 
                key={i}
                icon={<IconComp size={24} />}
                title={feat.title}
                desc={feat.description}
              />
            );
          })}
        </div>
      </section>

      {/* Trust Section */}
      <section id="compliance" className="trust-section">
        <div className="glass-panel trust-box">
          <Globe size={48} className="trust-icon" />
          <h3>{c.trust?.title || DEFAULTS.trust.title}</h3>
          <p>{c.trust?.description || DEFAULTS.trust.description}</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="section-header">
          <h2 className="text-gradient">{c.faq?.title || DEFAULTS.faq.title}</h2>
          <p>{c.faq?.subtitle || DEFAULTS.faq.subtitle}</p>
        </div>
        <div className="faq-grid">
          {(c.faq?.items || DEFAULTS.faq.items).map((item, i) => (
            <FaqItem key={i} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="landing-footer">
        <div className="footer-container glass-panel">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="nav-logo">
                <img src="/logo.webp" alt="GAFA" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                <span className="logo-text">GAFA AML</span>
              </div>
              <p className="brand-desc">
                {c.footer?.brandDescription || DEFAULTS.footer.brandDescription}
              </p>
              <div className="social-links">
                <a href="#" aria-label="LinkedIn"><Linkedin size={20} /></a>
                <a href="#" aria-label="Twitter"><Twitter size={20} /></a>
                <a href={`mailto:${c.footer?.email || DEFAULTS.footer.email}`} aria-label="Email"><Mail size={20} /></a>
              </div>
            </div>
            
            <div className="footer-links-grid">
              <div className="link-group">
                <h4>Platform</h4>
                <Link to="/login">Analyst Login</Link>
                <Link to="/login">Student Portal</Link>
                <a href="/admin">Admin Console</a>
                <a href="#features">Features</a>
              </div>
              <div className="link-group">
                <h4>Resources</h4>
                <a href="#">Documentation</a>
                <a href="#">AML Guidelines</a>
                <a href="#">Case Studies</a>
                <a href="#">Help Center</a>
              </div>
              <div className="link-group">
                <h4>Legal & Compliance</h4>
                <Link to="/terms">Terms of Service</Link>
                <Link to="/privacy">Privacy Policy</Link>
                <Link to="/audit">Audit Procedures</Link>
                <a href="#">Cookie Policy</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} {c.footer?.copyright || DEFAULTS.footer.copyright}. All rights reserved.</p>
            <div className="contact-info">
              <span><Mail size={14}/> {c.footer?.email || DEFAULTS.footer.email}</span>
              <span><Globe size={14}/> <a href={`https://${c.footer?.website || DEFAULTS.footer.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{c.footer?.website || DEFAULTS.footer.website}</a></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="glass-card feature-item">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

const NetworkAnimation = () => (
  <div className="hero-svg-container">
    <svg viewBox="0 0 800 600" className="network-svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gafa-accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--gafa-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      
      {/* Dynamic Network Lines */}
      <g className="network-lines">
        <path d="M 200,300 L 400,200 L 600,250 L 500,450 Z" stroke="var(--gafa-accent)" strokeOpacity="0.3" strokeWidth="1" fill="none" />
        <path d="M 400,200 L 500,100 L 650,150 L 600,250" stroke="var(--gafa-accent)" strokeOpacity="0.2" strokeWidth="1" fill="none" />
        <path d="M 200,300 L 100,250 L 150,150 L 400,200" stroke="var(--gafa-accent)" strokeOpacity="0.15" strokeWidth="1" fill="none" />
        <path d="M 500,450 L 600,550 L 750,400 L 600,250" stroke="var(--gafa-accent)" strokeOpacity="0.2" strokeWidth="1" fill="none" />
        <path d="M 200,300 L 250,500 L 400,550 L 500,450" stroke="var(--gafa-accent)" strokeOpacity="0.15" strokeWidth="1" fill="none" />
      </g>

      {/* Grid pattern / Globe rings represent global data */}
      <ellipse cx="400" cy="300" rx="300" ry="100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" className="globe-ring-1" />
      <ellipse cx="400" cy="300" rx="100" ry="300" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" className="globe-ring-2" />
      <circle cx="400" cy="300" r="280" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" className="globe-ring-3" />

      {/* Nodes */}
      <g className="nodes">
        <circle cx="400" cy="200" r="6" fill="var(--gafa-brand-green)" className="node-pulse" />
        <circle cx="400" cy="200" r="24" fill="url(#glow)" className="node-glow" />
        
        <circle cx="200" cy="300" r="4" fill="var(--gafa-accent)" />
        <circle cx="600" cy="250" r="5" fill="var(--gafa-accent)" className="node-float-1" />
        <circle cx="500" cy="450" r="4" fill="var(--gafa-brand-green)" />
        <circle cx="500" cy="100" r="3" fill="var(--gafa-accent)" className="node-float-2" />
        <circle cx="650" cy="150" r="4" fill="var(--gafa-accent)" />
        <circle cx="100" cy="250" r="3" fill="var(--gafa-brand-green)" className="node-float-3" />
        <circle cx="150" cy="150" r="4" fill="var(--gafa-accent)" />
        <circle cx="600" cy="550" r="3" fill="var(--gafa-accent)" />
        <circle cx="750" cy="400" r="4" fill="var(--gafa-brand-green)" className="node-float-1" />
        <circle cx="250" cy="500" r="3" fill="var(--gafa-accent)" />
        <circle cx="400" cy="550" r="4" fill="var(--gafa-accent)" />
      </g>
    </svg>
  </div>
);

function FaqItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="faq-item glass-card" onClick={() => setIsOpen(!isOpen)} style={{cursor: 'pointer'}}>
      <div className="faq-question">
        <h4>{question}</h4>
        {isOpen ? <ChevronUp size={20} className="gafa-brand-green" /> : <ChevronDown size={20} className="gafa-text-dim" />}
      </div>
      {isOpen && <div className="faq-answer"><p>{answer}</p></div>}
    </div>
  );
}
