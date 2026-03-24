import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { fetchInvestigations } from '../services/dataService';
import './pages.css';

export default function Investigations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [investigations, setInvestigations] = useState([]);
  const [myInvestigations, setMyInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvestigations();
  }, []);

  async function loadInvestigations() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;
      
      const [allCasesRes, myCasesRes] = await Promise.all([
        supabase.from('investigations').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('investigations').select('*').eq('assigned_to', currentUser?.id).order('created_at', { ascending: false }).limit(50)
      ]);
      
      setInvestigations(allCasesRes.data || []);
      setMyInvestigations(myCasesRes.data || []);
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  function exportMaltego(inv) {
    // Build CSV from investigation customer transactions
    const headers = 'From,To,Amount,Transaction_Type,Date,Risk_Level';
    const csvContent = headers + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.download = `GAFA_Maltego_Export_${inv.customer_id || 'unknown'}_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }



  const renderTable = (data, title) => (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        {title}
      </div>
      {data.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3>No cases found</h3>
          <p>Investigation cases will appear here once alerts are escalated.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Customer</th>
              <th>Risk</th>
              <th>Alert Type</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(inv => (
              <tr
                key={inv.case_id || inv.id}
                className="clickable-row"
                onClick={() => navigate(`/investigations/${inv.case_id}`)}
                role="button"
                tabIndex={0}
                aria-label={`Investigation ${inv.case_id}`}
              >
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{inv.case_id}</td>
                <td className="name-cell">{inv.customer_name || inv.customer_id}</td>
                <td>
                  <span className={`risk-badge ${(inv.risk_level || '').toLowerCase()}`}>
                    {inv.risk_level || 'N/A'}
                  </span>
                </td>
                <td style={{ fontSize: '0.75rem' }}>{inv.alert_type || 'N/A'}</td>
                <td>
                  <span className={`status-badge ${(inv.status || 'open').toLowerCase().replace(/[_ ]/g, '-')}`}>
                    {inv.status || 'open'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {inv.assigned_to ? 'Assigned' : 'Unassigned'}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => exportMaltego(inv)}
                    aria-label="Export for Maltego"
                  >
                    Export Maltego
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Investigations / SAR Workshop
        </h1>
        <p>Manage investigation cases and draft Suspicious Activity Reports</p>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner-sm" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading investigations...</p>
        </div>
      ) : (
        <>
          {renderTable(investigations, 'All Cases')}
          {renderTable(myInvestigations, 'My Assigned Cases')}
        </>
      )}
    </div>
  );
}
