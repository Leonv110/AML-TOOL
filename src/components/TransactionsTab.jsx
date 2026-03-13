import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  RefreshCw,
  ChevronDown,
  Info,
  ArrowLeft
} from 'lucide-react';
import './TransactionsTab.css';

const TransactionsTab = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    country: '',
    rule: ''
  });

  const rulesList = ['Geo-Risk', 'Dormancy', 'Structuring', 'Spike Detection', 'Layering'];
  const [countriesList, setCountriesList] = useState([]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('transactions').select('*');

      if (filters.startDate) query = query.gte('timestamp', filters.startDate);
      if (filters.endDate) query = query.lte('timestamp', filters.endDate);
      if (filters.minAmount) query = query.gte('amount', parseFloat(filters.minAmount));
      if (filters.maxAmount) query = query.lte('amount', parseFloat(filters.maxAmount));
      if (filters.country) query = query.eq('country_risk_level', filters.country);
      if (filters.rule) query = query.ilike('flagged_reason', `%${filters.rule}%`);

      query = query.order('timestamp', { ascending: false });

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      setTransactions(data || []);

      if (countriesList.length === 0 && data) {
         const uniqueCountries = [...new Set(data.filter(d => d.country_risk_level).map(item => item.country_risk_level))];
         setCountriesList(uniqueCountries);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTransactions();
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      country: '',
      rule: ''
    });
    setTimeout(() => {
        const fetchWithoutFilters = async () => {
             setLoading(true);
             const { data, error } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
             if (error) setError(error.message);
             else setTransactions(data || []);
             setLoading(false);
        }
        fetchWithoutFilters();
    }, 0);
  };

  return (
    <div className="transactions-container">
      
      {/* Header */}
      <header className="transactions-header">
        <div className="header-content">
          <h1>
            <Search size={28} />
            Transaction Monitoring
          </h1>
          <p>Real-time transaction surveillance and pattern detection</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <button onClick={fetchTransactions} className="refresh-btn">
            <RefreshCw size={16} className={loading ? "spinning" : ""} />
            Refresh Data
          </button>
        </div>
      </header>

      {/* Filters Form */}
      <div className="filters-card">
        <form onSubmit={handleSearch}>
          <div className="filters-grid">
            
            <div className="filter-group">
              <label>Start Date</label>
              <div className="filter-input-wrapper">
                <input 
                  type="date" 
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="filter-input"
                />
              </div>
            </div>
            
            <div className="filter-group">
              <label>End Date</label>
              <div className="filter-input-wrapper">
                <input 
                  type="date" 
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="filter-input"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Min Amount</label>
              <div className="filter-input-wrapper">
                <span className="icon-left">$</span>
                <input 
                  type="number" 
                  name="minAmount"
                  placeholder="0"
                  value={filters.minAmount}
                  onChange={handleFilterChange}
                  className="filter-input with-left-icon"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Max Amount</label>
              <div className="filter-input-wrapper">
                <span className="icon-left">$</span>
                <input 
                  type="number" 
                  name="maxAmount"
                  placeholder="Any"
                  value={filters.maxAmount}
                  onChange={handleFilterChange}
                  className="filter-input with-left-icon"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Country</label>
              <div className="filter-input-wrapper">
                <select 
                  name="country"
                  value={filters.country}
                  onChange={handleFilterChange}
                  className="filter-input with-right-icon"
                >
                  <option value="">All Countries</option>
                  {countriesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="icon-right" />
              </div>
            </div>

            <div className="filter-group">
              <label>Detected Rule</label>
              <div className="filter-input-wrapper">
                <select 
                  name="rule"
                  value={filters.rule}
                  onChange={handleFilterChange}
                  className="filter-input with-right-icon"
                >
                  <option value="">All Rules</option>
                  {rulesList.map(rule => (
                    <option key={rule} value={rule}>{rule}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="icon-right" />
              </div>
            </div>
          </div>

          <div className="filter-actions">
            <button type="button" onClick={resetFilters} className="btn-secondary">
              Clear Filters
            </button>
            <button type="submit" className="btn-primary">
              <Filter size={16} />
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Main Table Area */}
      <div className="table-card">
        {error && (
          <div className="error-banner">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        <div className="table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Date</th>
                <th>User ID</th>
                <th>Destination ID</th>
                <th className="text-right">Amount</th>
                <th>Country Risk</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-message-cell">
                     <div className="loading-state">
                        <RefreshCw size={32} />
                        <p>Loading transactions...</p>
                     </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-message-cell">
                     <div className="empty-state">
                        <Search size={48} />
                        <h3>No transactions found</h3>
                        <p>Try adjusting your filters to see more results.</p>
                     </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const countryRisk = String(tx.country_risk_level).toLowerCase();
                  return (
                  <tr 
                    key={tx.transaction_id || tx.id || Math.random().toString()} 
                    className={tx.is_flagged ? 'flagged' : 'clean'}
                  >
                    <td>
                      {tx.is_flagged ? (
                        <div className="tooltip-wrapper">
                           <span className="status-badge flagged">
                             <AlertTriangle size={14} />
                             Flagged
                           </span>
                           <div className="tooltip-content">
                              <h4><AlertTriangle size={12}/> Rules Triggered</h4>
                              <div>
                                {tx.flagged_reason 
                                  ? tx.flagged_reason.split(', ').map(r => <div key={r}>• {r}</div>) 
                                  : 'Unknown Reason'}
                              </div>
                              <div className="tooltip-arrow"></div>
                           </div>
                        </div>
                      ) : (
                        <span className="status-badge clean">
                           <div className="clean-dot"></div>
                           Clean
                        </span>
                      )}
                    </td>
                    <td className="font-mono-text">
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="font-medium-text">
                      {tx.user_id || 'N/A'}
                    </td>
                    <td className="font-mono-text">
                      {tx.destination_id || 'N/A'}
                    </td>
                    <td className="amount-text">
                      ${tx.amount != null ? parseFloat(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
                    </td>
                    <td>
                       <span className={`country-badge ${countryRisk === 'high' ? 'high' : countryRisk === 'medium' ? 'medium' : 'low'}`}>
                         {tx.country_risk_level || 'Unknown'}
                       </span>
                    </td>
                    <td>
                       <button className="action-btn" title="View Process Details">
                          <Info size={18} />
                       </button>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        {!loading && transactions.length > 0 && (
          <div className="table-footer">
            <span>Showing <strong>{transactions.length}</strong> transactions matching filters</span>
            <span>Limited by Supabase query rules</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsTab;
