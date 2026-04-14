import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, BarChart3, Search, Database, ChevronRight, Lock, Globe, Activity, Mail, Linkedin, Twitter, MapPin, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
              <span>Next-Gen Forensic Intelligence</span>
            </div>
            <h1 className="hero-title text-gradient">
              Forensic Intelligence <br />
              <span className="accent-gradient">Reimagined</span>
            </h1>
            <p className="hero-subtitle">
              The Global Association of Forensic Accountants (GAFA) provides elite Anti-Money Laundering tools 
              driven by advanced ML ensembles and real-time transaction monitoring.
            </p>
            <div className="hero-actions">
              <button onClick={() => navigate('/login')} className="gafa-btn gafa-btn-primary">
                Get Started Now <ChevronRight size={18} />
              </button>
              <button onClick={() => navigate('/terms')} className="gafa-btn glass-card">
                View Governance
              </button>
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
            <h2 className="text-gradient">About GAFA AML</h2>
            <p>
              The Global Association of Forensic Accountants (GAFA) has designed this flagship Anti-Money Laundering (AML) platform to bridge the gap between theoretical forensic accounting and practical, AI-driven threat detection.
            </p>
            <p>
              Built specifically for certified financial auditors, regulatory agencies, and forensic accounting students, our platform leverages massive parallel processing to analyze complex transaction networks, identifying layering and smurfing techniques that traditional rule sets fail to capture.
            </p>
            <div className="about-stats">
              <div className="stat-item">
                <span className="stat-number">99.2%</span>
                <span className="stat-label">Anomaly Detection Accuracy</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">&lt; 50ms</span>
                <span className="stat-label">Real-time Inference</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">Global</span>
                <span className="stat-label">Regulatory Compliance</span>
              </div>
            </div>
          </div>
          <div className="about-visual">
             <div className="glass-card compliance-badge">
                <Shield size={64} className="accent-gradient pulse" />
                <h3>Bank-grade Security</h3>
                <p>E2E Encrypted Forensic Ledgers</p>
             </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="text-gradient">Core Capabilities</h2>
          <p>Enterprise-grade tools for modern financial investigators</p>
        </div>
        <div className="features-grid">
          <FeatureCard 
            icon={<Search size={24} />}
            title="Advanced ML Detection"
            desc="Isolation Forest ensembles detect anomalies that traditional rule-based systems miss."
          />
          <FeatureCard 
            icon={<BarChart3 size={24} />}
            title="Real-time Analytics"
            desc="Visualize complex transaction webs and identify layered money movements instantly."
          />
          <FeatureCard 
            icon={<Database size={24} />}
            title="Secure Data Vault"
            desc="Military-grade encryption for sensitive forensic reports and evidence logs."
          />
          <FeatureCard 
            icon={<Lock size={24} />}
            title="Regulatory Compliance"
            desc="Built to align with global AML/CFT requirements and reporting standards."
          />
        </div>
      </section>

      {/* Trust Section */}
      <section id="compliance" className="trust-section">
        <div className="glass-panel trust-box">
          <Globe size={48} className="trust-icon" />
          <h3>Global Standards. Local Precision.</h3>
          <p>
            GAFA monitors over $50B in transaction volume through our partner networks, 
            ensuring that financial ecosystems remain transparent and secure.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="section-header">
          <h2 className="text-gradient">Frequently Asked Questions</h2>
          <p>Everything you need to know about the GAFA platform.</p>
        </div>
        <div className="faq-grid">
           <FaqItem 
              question="Who is this platform built for?" 
              answer="It is designed exclusively for certified forensic accountants, AML compliance officers at financial institutions, and students enrolled in GAFA certification programs." 
           />
           <FaqItem 
              question="How does the AI detection work?" 
              answer="We utilize an Isolation Forest Ensemble trained on vast, anonymized global transaction datasets. It identifies complex patterns of layering and geographic anomalies that trigger risk alerts before human auditors even look at the data." 
           />
           <FaqItem 
              question="Is my forensic data secure?" 
              answer="Absolutely. All data ingested for investigation is processed using AES-256 encryption. We comply with strict data residency laws and automatically scrub PII during bulk AI inference tasks." 
           />
           <FaqItem 
              question="Can I test the platform?" 
              answer="If you are a registered user, you can use the 'Student Portal' login role to access isolated sandbox environments filled with generated mock financial records for training purposes." 
           />
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
                Pioneering the future of forensic financial analysis with intelligent, real-time threat detection and comprehensive global compliance.
              </p>
              <div className="social-links">
                <a href="#" aria-label="LinkedIn"><Linkedin size={20} /></a>
                <a href="#" aria-label="Twitter"><Twitter size={20} /></a>
                <a href="mailto:contact@gafa.org" aria-label="Email"><Mail size={20} /></a>
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
            <p>© {new Date().getFullYear()} Global Association of Forensic Accountants. All rights reserved.</p>
            <div className="contact-info">
              <span><MapPin size={14}/> GAFA HQ, Mumbai, India</span>
              <span><Phone size={14}/> +91 (22) 1234 5678</span>
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
