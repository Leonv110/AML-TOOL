import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { screenCustomerManual } from '../services/screeningService';
import { fetchApiCountries } from '../services/dataService';
import './pages.css';

const ENTITY_TYPES = ['Person', 'Company', 'Organization', 'Crypto_Wallet', 'Vessel', 'Aircraft'];
const CATEGORIES = ['Sanctions', 'PEP', 'PEP Level 1', 'PEP Level 2', 'PEP Level 3', 'PEP Level 4', 'RCA', 'Adverse Media', 'SIP', 'SIE', 'Fitness and Probity', 'Insolvency', 'Warnings and Regulatory Enforcement', 'Law Enforcement', 'Businessperson', 'State Owned Enterprise'];

export default function Screening() {
  const location = useLocation();
  const incomingPerson = location.state?.person;

  const [viewMode, setViewMode] = useState('form'); // 'form' or 'results'
  
  const [countriesList, setCountriesList] = useState([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  
  const [name, setName] = useState(incomingPerson?.name || '');
  const [entityType, setEntityType] = useState(incomingPerson ? [incomingPerson.entity_type] : ['Person']);
  const [categories, setCategories] = useState(incomingPerson ? incomingPerson.category.split(',').map(c=>c.trim()) : ['PEP Level 1']);
  const [countries, setCountries] = useState([]); // array of country codes
  
  const initialDob = incomingPerson?.dob ? incomingPerson.dob.split('-') : [];
  const [dobDay, setDobDay] = useState(initialDob[0] || '');
  const [dobMonth, setDobMonth] = useState(initialDob[1] || '');
  const [dobYear, setDobYear] = useState(initialDob[2] || '');
  const [uniqueId, setUniqueId] = useState('');
  const [matchScore, setMatchScore] = useState(80);
  const [exactSearch, setExactSearch] = useState(false);
  const [aliasSearch, setAliasSearch] = useState(true);
  const [rcaSearch, setRcaSearch] = useState(true);
  const [ongoingMonitoring, setOngoingMonitoring] = useState(false);
  const [adverseMedia, setAdverseMedia] = useState(false);
  const [webhook, setWebhook] = useState('');
  const [image64, setImage64] = useState(null);
  const [groupData, setGroupData] = useState(false);
  const [clientRef, setClientRef] = useState('');
  const [riskEngineId, setRiskEngineId] = useState('');
  const [searchProfile, setSearchProfile] = useState('');
  
  const [result, setResult] = useState(null);
  const [screening, setScreening] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [detailsView, setDetailsView] = useState(null);

  const imageInputRef = useRef();

  useEffect(() => {
    fetchApiCountries().then(setCountriesList);
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setImage64(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File is too large. Max 5MB allowed.");
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleArrayItem = (item, arr, setArr) => {
    if (arr.includes(item)) setArr(arr.filter(i => i !== item));
    else setArr([...arr, item]);
  };

  const addCountry = (code) => {
    if (!countries.includes(code)) setCountries([...countries, code]);
    setCountrySearch('');
    setShowCountryDropdown(false);
  };

  const removeCountry = (code) => {
    setCountries(countries.filter(c => c !== code));
  };

  async function handleScreen() {
    setErrorMsg('');
    
    if (!name.trim()) return setErrorMsg('Name is required.');
    if (name.length > 100 || name.length < 2) return setErrorMsg('Name must be 2-100 characters.');
    if (entityType.length === 0) return setErrorMsg('At least one Entity Type must be selected.');
    if (categories.length === 0 && !searchProfile) return setErrorMsg('Select at least one Category or provide a Search Profile.');
    if (adverseMedia && (!webhook || !/^https?:\/\//.test(webhook))) return setErrorMsg('Valid Webhook URL is required for Adverse Media.');
    
    setScreening(true);

    const formatDob = () => {
      const d = dobDay || '00';
      const m = dobMonth || '00';
      const y = dobYear || '0000';
      if (d === '00' && m === '00' && y === '0000') return undefined; // Let backend handle
      return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y.padStart(4, '0')}`;
    };

    const payload = {
      name: name.trim(),
      entity_type: entityType,
      categories: categories,
      countries: countries.length > 0 ? countries : undefined,
      birth_incorporation_date: formatDob(),
      unique_identifier: uniqueId.trim() || undefined,
      match_score: exactSearch ? 100 : Number(matchScore),
      exact_search: exactSearch,
      alias_search: aliasSearch,
      rca_search: rcaSearch,
      ongoing_monitoring: ongoingMonitoring,
      adverse_media_monitoring: adverseMedia,
      webhook: adverseMedia ? webhook.trim() : undefined,
      biometric_search_image: image64,
      group_data: groupData,
      client_reference: clientRef.trim() || undefined,
      risk_score_engine_id: riskEngineId.trim() || undefined,
      search_profile: searchProfile.trim() || undefined
    };

    try {
      const res = await screenCustomerManual(payload);
      if (res.error) {
         setErrorMsg(res.error);
         console.error("API Error Details:", res.details);
      } else {
         setResult(res.screeningResult);
         setViewMode('results');
         setDetailsView(null);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Screening request failed');
    } finally {
      setScreening(false);
    }
  }

  const Toggle = ({ label, checked, onChange, helperText, disabled }) => (
    <div className="form-group" style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', gap: '0.75rem', fontWeight: 500, opacity: disabled ? 0.6 : 1 }}>
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
          disabled={disabled}
          style={{ width: '1.2rem', height: '1.2rem' }}
        />
        {label}
      </label>
      {helperText && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', marginLeft: '2rem' }}>{helperText}</p>}
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: viewMode === 'form' ? '950px' : '1400px', transition: 'max-width 0.3s ease' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <path d="M11 8v4M11 14h.01" />
            </svg>
            Comprehensive AML Screening
          </h1>
          <p>{viewMode === 'form' ? 'Screen individuals or entities through the complete AML Watcher engine.' : 'Review matches and risk warnings flagged by the engine.'}</p>
        </div>
        {viewMode === 'results' && (
          <button className="btn btn-secondary" onClick={() => setViewMode('form')}>
            &larr; Back to Configuration
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {viewMode === 'form' ? (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Search Parameters</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            
            <div className="form-group">
              <label>Name (Required) <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                type="text"
                placeholder="Individual or Company Name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Entity Types <span style={{color: 'red'}}>*</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {ENTITY_TYPES.map(type => (
                   <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.875rem', color: entityType.includes(type) ? 'var(--brand-accent)' : 'inherit' }}>
                     <input 
                       type="checkbox" 
                       checked={entityType.includes(type)}
                       onChange={() => toggleArrayItem(type, entityType, setEntityType)}
                     /> 
                     {type.replace('_', ' ')}
                   </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Categories</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem', maxHeight: '250px', overflowY: 'auto', padding: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                {CATEGORIES.map(cat => (
                   <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                     <input 
                       type="checkbox" 
                       checked={categories.includes(cat)}
                       onChange={() => toggleArrayItem(cat, categories, setCategories)}
                     /> 
                     {cat}
                   </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Countries (Optional)</label>
              <div className="custom-dropdown-container">
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ width: '100%' }}
                  placeholder="Search and click to add..." 
                  value={countrySearch}
                  onChange={e => { setCountrySearch(e.target.value); setShowCountryDropdown(true); }}
                  onFocus={() => setShowCountryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                />
                
                {showCountryDropdown && (
                  <div className="custom-dropdown-list">
                     {countriesList.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) && !countries.includes(c.code)).length === 0 && (
                        <div className="custom-dropdown-item" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No countries found</div>
                     )}
                     {countriesList
                       .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) && !countries.includes(c.code))
                       .slice(0, 50)
                       .map(c => (
                        <div key={c.code} className="custom-dropdown-item" onMouseDown={(e) => { e.preventDefault(); addCountry(c.code); }}>
                          {c.name} ({c.code})
                        </div>
                     ))}
                  </div>
                )}
              </div>
              
              {countries.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {countries.map(code => {
                    const cName = countriesList.find(x => x.code === code)?.name || code;
                    return (
                      <div key={code} className="country-pill">
                        {cName}
                        <button onClick={(e) => { e.preventDefault(); removeCountry(code); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
              <div>
                <label>Birth / Incorporation Date</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <select className="form-input" style={{ flex: 1 }} value={dobDay} onChange={e => setDobDay(e.target.value)}>
                    <option value="">Day</option>
                    {Array.from({length: 31}, (_, i) => String(i+1).padStart(2, '0')).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select className="form-input" style={{ flex: 1 }} value={dobMonth} onChange={e => setDobMonth(e.target.value)}>
                    <option value="">Month</option>
                    {Array.from({length: 12}, (_, i) => String(i+1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="form-input" style={{ flex: 1 }} value={dobYear} onChange={e => setDobYear(e.target.value)}>
                    <option value="">Year</option>
                    {Array.from({length: 100}, (_, i) => String(new Date().getFullYear() - i)).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label>Unique Identifier</label>
                <input className="form-input" style={{ marginTop: '0.5rem', width: '100%' }} type="text" placeholder="Passports, SSN, etc." value={uniqueId} onChange={e => setUniqueId(e.target.value)} />
              </div>
            </div>

            <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Match Score Limit</span>
                <span style={{ fontWeight: '800', color: 'var(--brand-accent)' }}>{exactSearch ? 100 : matchScore}</span>
              </label>
              <input 
                className="custom-range-slider"
                type="range" 
                min="0" max="100" 
                value={exactSearch ? 100 : matchScore} 
                onChange={e => setMatchScore(e.target.value)}
                disabled={exactSearch}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
                A lower score will return more partial matches. 80 is the recommended default.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Search Behavior</h4>
                <Toggle label="Exact Search" checked={exactSearch} onChange={setExactSearch} helperText="Locks match score to 100" />
                <Toggle label="Alias Search" checked={aliasSearch} onChange={setAliasSearch} />
                <Toggle label="RCA Search" checked={rcaSearch} onChange={setRcaSearch} helperText="Relatives & Close Associates" />
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Continuous Monitoring</h4>
                <Toggle label="Ongoing Monitoring" checked={ongoingMonitoring} onChange={setOngoingMonitoring} />
                <Toggle label="Adverse Media" checked={adverseMedia} onChange={setAdverseMedia} />
                {adverseMedia && (
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label>Webhook URL <span style={{color: 'red'}}>*</span></label>
                    <input className="form-input" type="text" placeholder="https://..." value={webhook} onChange={e => setWebhook(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
               <label>Biometric Search Image (Max 5MB)</label>
               <input type="file" accept=".jpg,.jpeg,.png" ref={imageInputRef} onChange={handleImageChange} className="form-input" style={{ padding: '0.5rem' }}/>
               {image64 && <img src={image64} alt="Preview" style={{ marginTop: '1rem', maxHeight: '120px', borderRadius: '8px', border: '2px solid var(--border-color)', objectFit: 'cover' }} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                  <label>Search Profile</label>
                  <input className="form-input" type="text" placeholder="Overrides categories if provided" value={searchProfile} onChange={e => setSearchProfile(e.target.value)} />
              </div>
              
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '1rem' }}>
                <Toggle label="Group Data" checked={groupData} onChange={setGroupData} helperText="Group results by data source." />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleScreen}
              disabled={screening}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1rem', justifyContent: 'center' }}
            >
              {screening ? 'Crunching API Engine...' : 'Execute Full Screening'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '60vh' }}>
          {/* Results View */}
          {!result ? (
             <div className="empty-state">
                <p>No results state active.</p>
             </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Returned Matches: {result.data?.pagination?.total_records || result.data?.total_records || 0}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Query: <strong style={{color: 'var(--text-primary)'}}>{result.data?.searched_name || name}</strong>  —  Score Limit: <strong style={{color: 'var(--text-primary)'}}>{exactSearch ? 100 : matchScore}</strong>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ display: 'inline-flex', padding: '0.4rem 1rem', background: result.has_error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: result.has_error ? '#ef4444' : '#22c55e', borderRadius: '99px', fontWeight: 600, border: `1px solid ${result.has_error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}` }}>
                    {result.has_error ? 'API Fault' : 'API Success'}
                  </div>
                  <button onClick={() => setDetailsView(detailsView === 'ALL' ? null : 'ALL')} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    {detailsView === 'ALL' ? 'Close Raw Data' : 'View Full JSON Payload'}
                  </button>
                </div>
              </div>

              {detailsView === 'ALL' && (
                <div style={{ background: '#1e1e1e', borderRadius: '6px', padding: '1rem', overflowY: 'auto', marginBottom: '1.5rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#d4d4d4', maxHeight: '400px' }}>
                  <pre style={{ margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}

              {(result.data?.records?.length > 0 || result.data?.results?.length > 0) ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))', gap: '1.25rem' }}>
                  {(result.data.records || result.data.results || []).map((record, i) => (
                    <div key={record.id || i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>{record.name}</h3>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {record.entity_types?.join(', ')} • {record.countries?.join(', ')}
                          </div>
                        </div>
                        
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                              display: 'inline-flex', 
                              padding: '0.3rem 0.75rem', 
                              borderRadius: '99px', 
                              fontSize: '0.8rem', 
                              fontWeight: 700,
                              background: record.risk_level === 'High' ? 'rgba(239, 68, 68, 0.1)' : record.risk_level === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                              color: record.risk_level === 'High' ? '#ef4444' : record.risk_level === 'Medium' ? '#f59e0b' : '#22c55e',
                              border: `1px solid ${record.risk_level === 'High' ? 'rgba(239, 68, 68, 0.3)' : record.risk_level === 'Medium' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                          }}>
                              {record.risk_level} Risk {record.risk_score ? `(${record.risk_score})` : ''}
                          </div>
                          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {record.match_status}
                          </div>
                        </div>
                      </div>

                      {record.categories?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.75rem 0' }}>
                          {record.categories.map((cat, j) => (
                            <span key={j} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500 }}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      {record.source_details?.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Sources</div>
                          {record.source_details.map((src, j) => (
                            <div key={j} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-accent)' }}></div>
                              <span style={{flex: 1}}>{src.publisher}</span>
                              {src.url && <a href={src.url.startsWith('http') ? src.url : `https://${src.url}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-accent)', textDecoration: 'none', fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px' }}>Visit Source</a>}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button 
                        onClick={() => setDetailsView(detailsView === record.id ? null : record.id)}
                        style={{ marginTop: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem', borderRadius: '6px', transition: 'background 0.2s', width: '100%', fontWeight: 500 }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseOut={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      >
                        {detailsView === record.id ? 'Collapse Advanced Info' : 'Show Advanced Info'}
                      </button>

                      {detailsView === record.id && (
                        <div style={{ marginTop: '0.75rem', background: '#0a0d14', borderRadius: '6px', padding: '1rem', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s' }}>
                          
                          {record.data?.additional_information?.flag_summary?.length > 0 && (
                            <div style={{ marginBottom: '1.25rem' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Flag Summary</h4>
                              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                {record.data.additional_information.flag_summary.map((flag, k) => (
                                  <li key={k} style={{ marginBottom: '0.3rem' }}>{flag}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {record.data?.sanction_details?.length > 0 && (
                            <div>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Sanctions Programmes</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {record.data.sanction_details.map((sanc, k) => (
                                  <div key={k} style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-primary)', borderLeft: '3px solid #ef4444' }}>
                                    {sanc.list && <div style={{ marginBottom: '0.2rem' }}><strong style={{ color: 'var(--text-secondary)' }}>List:</strong> {sanc.list}</div>}
                                    {sanc.programme && <div style={{ marginBottom: '0.2rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Programme:</strong> {sanc.programme}</div>}
                                    {sanc.type && <div><strong style={{ color: 'var(--text-secondary)' }}>Type:</strong> {sanc.type}</div>}
                                    {!sanc.list && !sanc.programme && !sanc.type && <div>{JSON.stringify(sanc)}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(!record.data?.additional_information?.flag_summary?.length && !record.data?.sanction_details?.length) && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                                  No advanced flag summary or sanction programmes returned for this match.
                              </div>
                          )}
                        </div>
                      )}
                      
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{flex: 1}}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{marginBottom: '1rem', opacity: 0.5}}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h3 style={{fontSize: '1.25rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)'}}>No Matching Records</h3>
                  <p style={{margin: 0, color: 'var(--text-muted)'}}>We couldn't find any profiles matching your strict criteria.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
