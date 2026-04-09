import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="auth-page">
      <div className="liquid-bg" />
      <div className="glass-panel" style={{ maxWidth: '800px', padding: '3rem' }}>
        <Link to="/" className="gafa-btn glass-card" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
          <ArrowLeft size={18} /> Back to Home
        </Link>
        <h1 className="text-gradient" style={{ marginBottom: '1.5rem' }}>Terms of Service</h1>
        <div className="legal-content" style={{ color: 'var(--gafa-text-dim)', lineHeight: '1.8' }}>
          <p style={{ marginBottom: '1rem' }}>Last Updated: April 9, 2026</p>
          <p>By accessing the Global Association of Forensic Accountants (GAFA) AML Tool, you agree to comply with all international financial monitoring regulations. This platform is provided for authorized investigative purposes only.</p>
          <h3 style={{ color: 'white', margin: '1.5rem 0 0.5rem' }}>1. Authorized Use</h3>
          <p>Any unauthorized attempt to bypass security protocols or access restricted datasets will be reported to relevant legal authorities.</p>
          <h3 style={{ color: 'white', margin: '1.5rem 0 0.5rem' }}>2. Data Privacy</h3>
          <p>Uploaded datasets are processed using localized ML models. GAFA does not permanently store sensitive identifiable data unless explicitly flagged for forensic reporting.</p>
        </div>
      </div>
    </div>
  );
}
