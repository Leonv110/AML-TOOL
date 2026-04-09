import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="auth-page">
      <div className="liquid-bg" />
      <div className="glass-panel" style={{ maxWidth: '800px', padding: '3rem' }}>
        <Link to="/" className="gafa-btn glass-card" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
          <ArrowLeft size={18} /> Back to Home
        </Link>
        <h1 className="text-gradient" style={{ marginBottom: '1.5rem' }}>Privacy Policy</h1>
        <div className="legal-content" style={{ color: 'var(--gafa-text-dim)', lineHeight: '1.8' }}>
          <p style={{ marginBottom: '1rem' }}>Your privacy is paramount at GAFA.</p>
          <p>We implement military-grade encryption for all data in transit. Our ML models operate on anonymized feature sets to protect individual customer identities during the scoring process.</p>
          <h3 style={{ color: 'white', margin: '1.5rem 0 0.5rem' }}>Data Retention</h3>
          <p>Logs related to forensic investigations are retained for a minimum of 5 years as per global AML standards, while unflagged transaction data is routinely purged.</p>
        </div>
      </div>
    </div>
  );
}
