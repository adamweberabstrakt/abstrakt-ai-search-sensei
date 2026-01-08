import React, { useState } from 'react';

const EntitySEOChecker = () => {
  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    industry: '',
    keywords: '',
    leadership: [{ name: '', title: '' }],
    competitors: [{ name: '', website: '', leadership: { name: '', title: '' } }]
  });

  // LLM selection - default to ChatGPT and Gemini only
  const [selectedLLMs, setSelectedLLMs] = useState({
    chatgpt: true,
    gemini: true,
    claude: false,
    perplexity: false,
    copilot: false
  });

  // Analysis state
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState(null);

  // SEMRush state
  const [semrushData, setSemrushData] = useState(null);
  const [semrushLoading, setSemrushLoading] = useState(false);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  // Debug state
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const llmOptions = [
    { id: 'chatgpt', name: 'ChatGPT', color: '#10a37f' },
    { id: 'gemini', name: 'Google Gemini', color: '#4285f4' },
    { id: 'claude', name: 'Claude', color: '#cc785c' },
    { id: 'perplexity', name: 'Perplexity', color: '#20808d' },
    { id: 'copilot', name: 'Microsoft Copilot', color: '#00bcf2' }
  ];

  // Debug logging
  const addLog = (msg, data = null) => {
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    setDebugLogs(prev => [...prev, { ts, msg, data }]);
    console.log(`[${ts}] ${msg}`, data || '');
  };

  // Input handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLeadershipChange = (index, field, value) => {
    const updated = [...formData.leadership];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, leadership: updated }));
  };

  const addLeadership = () => {
    if (formData.leadership.length < 3) {
      setFormData(prev => ({
        ...prev,
        leadership: [...prev.leadership, { name: '', title: '' }]
      }));
    }
  };

  const removeLeadership = (index) => {
    if (formData.leadership.length > 1) {
      setFormData(prev => ({
        ...prev,
        leadership: prev.leadership.filter((_, i) => i !== index)
      }));
    }
  };

  const handleCompetitorChange = (index, field, value) => {
    const updated = [...formData.competitors];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updated[index][parent][child] = value;
    } else {
      updated[index][field] = value;
    }
    setFormData(prev => ({ ...prev, competitors: updated }));
  };

  const addCompetitor = () => {
    if (formData.competitors.length < 3) {
      setFormData(prev => ({
        ...prev,
        competitors: [...prev.competitors, { name: '', website: '', leadership: { name: '', title: '' } }]
      }));
    }
  };

  const removeCompetitor = (index) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index)
    }));
  };

  // SEMRush API call
  const fetchSemrushData = async (domain) => {
    if (!domain) return null;
    
    addLog(`Fetching SEMRush data for: ${domain}`);
    
    try {
      const response = await fetch('/api/semrush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, type: 'all' })
      });

      if (!response.ok) {
        const err = await response.json();
        addLog('SEMRush error', err);
        return null;
      }

      const data = await response.json();
      addLog('SEMRush data received', data);
      return data;
    } catch (err) {
      addLog('SEMRush fetch failed', err.message);
      return null;
    }
  };

  // AI Analysis API call
  const analyzeQuery = async (query, llmName, analysisType = 'entity') => {
    addLog(`Analyzing: ${query.substring(0, 50)}... on ${llmName}`);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, llmName, analysisType })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      addLog(`Analysis error: ${err.message}`);
      return {
        error: true,
        errorMessage: err.message,
        summary: `Error: ${err.message}`,
        entityFound: false,
        confidenceScore: 0,
        sentimentScore: 0,
        sentiment: 'unknown',
        topSources: [],
        recommendations: 'Analysis failed'
      };
    }
  };

  // Main analysis function
  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setSemrushData(null);
    setDebugLogs([]);

    addLog('Starting analysis...');

    const selectedLLMList = Object.entries(selectedLLMs)
      .filter(([_, selected]) => selected)
      .map(([id]) => llmOptions.find(l => l.id === id));

    if (selectedLLMList.length === 0) {
      setError('Please select at least one AI search engine');
      setLoading(false);
      return;
    }

    const allResults = {
      companyName: formData.companyName,
      website: formData.website,
      company: {},
      leadership: [],
      competitors: [],
      semrushData: null
    };

    try {
      // Calculate total queries
      let totalQueries = selectedLLMList.length; // company
      totalQueries += selectedLLMList.length * formData.leadership.filter(l => l.name).length;
      totalQueries += selectedLLMList.length * formData.competitors.filter(c => c.name).length;
      totalQueries += formData.competitors.filter(c => c.leadership?.name).length * selectedLLMList.length;
      
      let currentQuery = 0;

      // Fetch SEMRush data for main company
      if (formData.website) {
        setSemrushLoading(true);
        setProgress({ current: 0, total: totalQueries, message: 'Fetching SEMRush data...' });
        const mainSemrush = await fetchSemrushData(formData.website);
        allResults.semrushData = mainSemrush?.data || null;
        setSemrushData(mainSemrush?.data || null);
        setSemrushLoading(false);
      }

      // Analyze company on each LLM
      for (const llm of selectedLLMList) {
        currentQuery++;
        setProgress({ 
          current: currentQuery, 
          total: totalQueries, 
          message: `Analyzing ${formData.companyName} on ${llm.name}...` 
        });
        
        const query = `Tell me about ${formData.companyName}${formData.industry ? ` in the ${formData.industry} industry` : ''}. ${formData.website ? `Their website is ${formData.website}.` : ''} ${formData.keywords ? `Focus on: ${formData.keywords}` : ''}`;
        
        const result = await analyzeQuery(query, llm.name, 'entity');
        allResults.company[llm.id] = { llm, results: result };
      }

      // Analyze leadership
      for (const leader of formData.leadership.filter(l => l.name)) {
        const leaderResults = { name: leader.name, title: leader.title, byLLM: {} };
        
        for (const llm of selectedLLMList) {
          currentQuery++;
          setProgress({ 
            current: currentQuery, 
            total: totalQueries, 
            message: `Analyzing ${leader.name} on ${llm.name}...` 
          });
          
          const query = `Tell me about ${leader.name}${leader.title ? `, ${leader.title}` : ''} at ${formData.companyName}. What is their reputation, thought leadership, and online presence?`;
          const result = await analyzeQuery(query, llm.name, 'leadership');
          leaderResults.byLLM[llm.id] = { llm, results: result };
        }
        
        allResults.leadership.push(leaderResults);
      }

      // Analyze competitors
      for (const competitor of formData.competitors.filter(c => c.name)) {
        const competitorResults = { 
          name: competitor.name, 
          website: competitor.website,
          byLLM: {},
          leadership: null,
          semrushData: null
        };

        // Fetch SEMRush for competitor
        if (competitor.website) {
          const compSemrush = await fetchSemrushData(competitor.website);
          competitorResults.semrushData = compSemrush?.data || null;
        }
        
        for (const llm of selectedLLMList) {
          currentQuery++;
          setProgress({ 
            current: currentQuery, 
            total: totalQueries, 
            message: `Analyzing ${competitor.name} on ${llm.name}...` 
          });
          
          const query = `Analyze ${competitor.name}${competitor.website ? ` (${competitor.website})` : ''} as a competitor. What is their online presence, backlink profile, and content strategy?`;
          const result = await analyzeQuery(query, llm.name, 'competitor');
          competitorResults.byLLM[llm.id] = { llm, results: result };
        }

        // Competitor leadership
        if (competitor.leadership?.name) {
          const leaderResults = { name: competitor.leadership.name, title: competitor.leadership.title, byLLM: {} };
          for (const llm of selectedLLMList) {
            currentQuery++;
            setProgress({ current: currentQuery, total: totalQueries, message: `Analyzing ${competitor.leadership.name}...` });
            const query = `Tell me about ${competitor.leadership.name}${competitor.leadership.title ? `, ${competitor.leadership.title}` : ''} at ${competitor.name}.`;
            const result = await analyzeQuery(query, llm.name, 'leadership');
            leaderResults.byLLM[llm.id] = { llm, results: result };
          }
          competitorResults.leadership = leaderResults;
        }
        
        allResults.competitors.push(competitorResults);
      }

      addLog('Analysis complete', allResults);
      setResults(allResults);
      
    } catch (err) {
      addLog(`Analysis error: ${err.message}`);
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0, message: '' });
    }
  };

  // Send email report
  const sendEmailReport = async () => {
    if (!emailForm.name || !emailForm.company || !emailForm.email) {
      setEmailStatus({ type: 'error', message: 'All fields are required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailForm.email)) {
      setEmailStatus({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    setEmailSending(true);
    setEmailStatus(null);

    try {
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: emailForm.name,
          recipientCompany: emailForm.company,
          recipientEmail: emailForm.email,
          reportData: {
            ...results,
            semrushData: semrushData
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to send email');
      }

      setEmailStatus({ type: 'success', message: `Report sent to ${emailForm.email}!` });
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailStatus(null);
        setEmailForm({ name: '', company: '', email: '' });
      }, 3000);

    } catch (err) {
      setEmailStatus({ type: 'error', message: err.message });
    } finally {
      setEmailSending(false);
    }
  };

  // Helper functions
  const getScoreColor = (score) => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#eab308';
    if (score >= 2) return '#f97316';
    return '#ef4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Needs Work';
    if (score >= 2) return 'Poor';
    return 'Critical';
  };

  const calculateAvgScore = (byLLM) => {
    const scores = Object.values(byLLM || {})
      .map(r => r.results?.confidenceScore || 0)
      .filter(s => s > 0);
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
      color: '#e8e8e8',
      padding: '20px'
    },
    card: {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '24px',
      marginBottom: '20px'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)',
      background: 'rgba(0,0,0,0.3)',
      color: '#fff',
      fontSize: '14px',
      marginTop: '8px',
      boxSizing: 'border-box'
    },
    button: {
      background: 'linear-gradient(135deg, #E85D04 0%, #F48C06 100%)',
      color: '#fff',
      border: 'none',
      padding: '14px 28px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    buttonSecondary: {
      background: 'rgba(255,255,255,0.1)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.2)',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      cursor: 'pointer'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: '#1a1a2e',
      borderRadius: '16px',
      padding: '32px',
      maxWidth: '450px',
      width: '90%',
      border: '1px solid rgba(255,255,255,0.1)'
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700',
            background: 'linear-gradient(90deg, #E85D04, #F48C06)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px'
          }}>
            Entity SEO Checker
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            AI Search Visibility & Backlink Analysis by Abstrakt Marketing Group
          </p>
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => setDebugMode(!debugMode)}
              style={{ ...styles.buttonSecondary, fontSize: '12px', padding: '6px 12px' }}
            >
              {debugMode ? '🔧 Debug ON' : '🔧 Debug'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.2)', 
            border: '1px solid #ef4444', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '20px' 
          }}>
            ❌ {error}
          </div>
        )}

        {/* Company Information */}
        <div style={styles.card}>
          <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>Company Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div>
              <label>Company Name *</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                placeholder="e.g., Abstrakt Marketing Group"
                style={styles.input}
              />
            </div>
            <div>
              <label>Website (for SEMRush data)</label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="e.g., abstraktmg.com"
                style={styles.input}
              />
            </div>
            <div>
              <label>Industry</label>
              <input
                type="text"
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                placeholder="e.g., B2B Marketing"
                style={styles.input}
              />
            </div>
            <div>
              <label>Target Keywords</label>
              <input
                type="text"
                name="keywords"
                value={formData.keywords}
                onChange={handleInputChange}
                placeholder="e.g., SEO, lead generation"
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* Leadership */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#F48C06', margin: 0 }}>Leadership Team</h2>
            {formData.leadership.length < 3 && (
              <button onClick={addLeadership} style={styles.buttonSecondary}>+ Add</button>
            )}
          </div>
          {formData.leadership.map((leader, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'end' }}>
              <div>
                <label>Name</label>
                <input
                  type="text"
                  value={leader.name}
                  onChange={(e) => handleLeadershipChange(i, 'name', e.target.value)}
                  placeholder="Full name"
                  style={styles.input}
                />
              </div>
              <div>
                <label>Title</label>
                <input
                  type="text"
                  value={leader.title}
                  onChange={(e) => handleLeadershipChange(i, 'title', e.target.value)}
                  placeholder="Job title"
                  style={styles.input}
                />
              </div>
              {formData.leadership.length > 1 && (
                <button onClick={() => removeLeadership(i)} style={{ ...styles.buttonSecondary, padding: '12px', marginTop: '8px' }}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Competitors */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#F48C06', margin: 0 }}>Competitors (for gap analysis)</h2>
            {formData.competitors.length < 3 && (
              <button onClick={addCompetitor} style={styles.buttonSecondary}>+ Add</button>
            )}
          </div>
          {formData.competitors.map((comp, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong>Competitor {i + 1}</strong>
                <button onClick={() => removeCompetitor(i)} style={styles.buttonSecondary}>Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Company</label>
                  <input type="text" value={comp.name} onChange={(e) => handleCompetitorChange(i, 'name', e.target.value)} placeholder="Name" style={styles.input} />
                </div>
                <div>
                  <label>Website</label>
                  <input type="text" value={comp.website} onChange={(e) => handleCompetitorChange(i, 'website', e.target.value)} placeholder="website.com" style={styles.input} />
                </div>
                <div>
                  <label>Leader Name</label>
                  <input type="text" value={comp.leadership.name} onChange={(e) => handleCompetitorChange(i, 'leadership.name', e.target.value)} placeholder="CEO name" style={styles.input} />
                </div>
                <div>
                  <label>Leader Title</label>
                  <input type="text" value={comp.leadership.title} onChange={(e) => handleCompetitorChange(i, 'leadership.title', e.target.value)} placeholder="Title" style={styles.input} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* LLM Selection */}
        <div style={styles.card}>
          <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>AI Search Engines</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {llmOptions.map(llm => (
              <div
                key={llm.id}
                onClick={() => setSelectedLLMs(prev => ({ ...prev, [llm.id]: !prev[llm.id] }))}
                style={{
                  padding: '10px 16px',
                  borderRadius: '20px',
                  border: `2px solid ${selectedLLMs[llm.id] ? llm.color : 'rgba(255,255,255,0.2)'}`,
                  background: selectedLLMs[llm.id] ? `${llm.color}20` : 'transparent',
                  color: selectedLLMs[llm.id] ? llm.color : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {selectedLLMs[llm.id] ? '✓ ' : ''}{llm.name}
              </div>
            ))}
          </div>
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            💡 Fewer LLMs = lower API costs. ChatGPT + Gemini recommended for most analyses.
          </p>
        </div>

        {/* Run Button */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <button
            onClick={runAnalysis}
            disabled={loading || !formData.companyName}
            style={{
              ...styles.button,
              opacity: (loading || !formData.companyName) ? 0.5 : 1,
              cursor: (loading || !formData.companyName) ? 'not-allowed' : 'pointer',
              minWidth: '200px'
            }}
          >
            {loading ? `Analyzing... (${progress.current}/${progress.total})` : 'Run Analysis'}
          </button>
          {loading && progress.message && (
            <p style={{ marginTop: '12px', color: '#F48C06' }}>{progress.message}</p>
          )}
        </div>

        {/* Debug Logs */}
        {debugMode && debugLogs.length > 0 && (
          <div style={{ ...styles.card, background: 'rgba(0,0,0,0.5)', fontFamily: 'monospace', fontSize: '11px', maxHeight: '300px', overflow: 'auto' }}>
            <h4 style={{ color: '#F48C06' }}>Debug Logs</h4>
            {debugLogs.map((log, i) => (
              <div key={i} style={{ borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>[{log.ts}]</span> {log.msg}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && (
          <>
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowEmailModal(true)} style={styles.button}>
                📧 Email My Report
              </button>
            </div>

            {/* SEMRush Data Card */}
            {semrushData && (
              <div style={styles.card}>
                <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>📊 SEMRush Backlink Data</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                  {semrushData.authorityScore !== undefined && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', fontWeight: '700', color: getScoreColor(semrushData.authorityScore / 10) }}>
                        {semrushData.authorityScore}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Authority Score</div>
                    </div>
                  )}
                  {semrushData.backlinks && (
                    <>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                          {semrushData.backlinks.total?.toLocaleString() || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Total Backlinks</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                          {semrushData.backlinks.referringDomains?.toLocaleString() || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Referring Domains</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#eab308' }}>
                          {semrushData.backlinks.followLinks?.toLocaleString() || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Follow Links</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Top Backlinks */}
                {semrushData.topBacklinks && semrushData.topBacklinks.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Top Referring Domains</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'hidden' }}>
                      {semrushData.topBacklinks.slice(0, 10).map((link, i) => (
                        <div key={i} style={{ 
                          padding: '12px 16px', 
                          borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {link.sourceUrl}
                            </div>
                            {link.anchor && (
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                                Anchor: {link.anchor}
                              </div>
                            )}
                          </div>
                          <div style={{ 
                            background: getScoreColor(link.authorityScore / 10),
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginLeft: '12px'
                          }}>
                            AS: {link.authorityScore}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Company AI Visibility */}
            <div style={styles.card}>
              <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>🤖 AI Search Visibility: {results.companyName}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {Object.entries(results.company).map(([llmId, data]) => {
                  const score = data.results?.confidenceScore || 0;
                  const hasError = data.results?.error;
                  
                  return (
                    <div key={llmId} style={{ 
                      background: 'rgba(0,0,0,0.3)', 
                      padding: '16px', 
                      borderRadius: '8px',
                      borderLeft: `4px solid ${hasError ? '#ef4444' : data.llm.color}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <strong style={{ color: data.llm.color }}>{data.llm.name}</strong>
                        {!hasError && (
                          <span style={{ 
                            background: getScoreColor(score),
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {score}/10 - {getScoreLabel(score)}
                          </span>
                        )}
                      </div>
                      
                      {hasError ? (
                        <p style={{ color: '#ef4444' }}>❌ {data.results.errorMessage}</p>
                      ) : (
                        <>
                          <p style={{ fontSize: '14px', marginBottom: '12px', color: 'rgba(255,255,255,0.8)' }}>
                            {data.results?.summary}
                          </p>
                          {data.results?.recommendations && (
                            <div style={{ background: 'rgba(248,140,6,0.1)', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                              <strong style={{ color: '#F48C06' }}>Recommendation:</strong><br />
                              {data.results.recommendations}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leadership */}
            {results.leadership.length > 0 && (
              <div style={styles.card}>
                <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>👤 Leadership Visibility</h2>
                {results.leadership.map((leader, i) => (
                  <div key={i} style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '12px' }}>{leader.name} {leader.title && `- ${leader.title}`}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {Object.entries(leader.byLLM).map(([llmId, data]) => (
                        <div key={llmId} style={{
                          background: 'rgba(0,0,0,0.3)',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          borderLeft: `3px solid ${data.llm.color}`,
                          minWidth: '120px'
                        }}>
                          <div style={{ fontSize: '12px', color: data.llm.color }}>{data.llm.name}</div>
                          <div style={{ fontSize: '20px', fontWeight: '700', color: getScoreColor(data.results?.sentimentScore || 5) }}>
                            {data.results?.sentimentScore || 5}/10
                          </div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Sentiment</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Competitor Gap Analysis */}
            {results.competitors.length > 0 && (
              <div style={styles.card}>
                <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>⚔️ Competitor Backlink Gap Analysis</h2>
                
                {/* Comparison Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#F48C06' }}>Company</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Authority</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Backlinks</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Ref. Domains</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>AI Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Your company row */}
                      <tr style={{ background: 'rgba(248,140,6,0.1)' }}>
                        <td style={{ padding: '12px', fontWeight: '600' }}>{results.companyName} (You)</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{semrushData?.authorityScore || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{semrushData?.backlinks?.total?.toLocaleString() || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{semrushData?.backlinks?.referringDomains?.toLocaleString() || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ color: getScoreColor(calculateAvgScore(results.company)) }}>
                            {calculateAvgScore(results.company)}/10
                          </span>
                        </td>
                      </tr>
                      {/* Competitor rows */}
                      {results.competitors.map((comp, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <td style={{ padding: '12px' }}>{comp.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{comp.semrushData?.authorityScore || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{comp.semrushData?.backlinks?.total?.toLocaleString() || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{comp.semrushData?.backlinks?.referringDomains?.toLocaleString() || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ color: getScoreColor(calculateAvgScore(comp.byLLM)) }}>
                              {calculateAvgScore(comp.byLLM)}/10
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Competitor Top Backlinks */}
                {results.competitors.map((comp, i) => (
                  comp.semrushData?.topBacklinks && comp.semrushData.topBacklinks.length > 0 && (
                    <div key={i} style={{ marginTop: '24px' }}>
                      <h4 style={{ marginBottom: '8px', color: 'rgba(255,255,255,0.8)' }}>
                        🔗 {comp.name}'s Top Backlinks (Gap Opportunities)
                      </h4>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        {comp.semrushData.topBacklinks.slice(0, 5).map((link, j) => (
                          <div key={j} style={{ 
                            padding: '8px 0', 
                            borderBottom: j < 4 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            fontSize: '13px'
                          }}>
                            <span style={{ color: '#3b82f6' }}>{link.sourceUrl}</span>
                            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}>
                              (AS: {link.authorityScore})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </>
        )}

        {/* Email Modal */}
        {showEmailModal && (
          <div style={styles.modal} onClick={() => setShowEmailModal(false)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>📧 Email My Report</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label>Your Name *</label>
                <input
                  type="text"
                  value={emailForm.name}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  style={styles.input}
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label>Company *</label>
                <input
                  type="text"
                  value={emailForm.company}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Your Company Name"
                  style={styles.input}
                />
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label>Email Address *</label>
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@company.com"
                  style={styles.input}
                />
              </div>

              {emailStatus && (
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  background: emailStatus.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                  color: emailStatus.type === 'error' ? '#ef4444' : '#22c55e'
                }}>
                  {emailStatus.type === 'success' ? '✅' : '❌'} {emailStatus.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={sendEmailReport}
                  disabled={emailSending}
                  style={{ 
                    ...styles.button, 
                    flex: 1,
                    opacity: emailSending ? 0.5 : 1 
                  }}
                >
                  {emailSending ? 'Sending...' : 'Send Report'}
                </button>
                <button
                  onClick={() => setShowEmailModal(false)}
                  style={styles.buttonSecondary}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          Built by Abstrakt Marketing Group | Entity-Based SEO & Backlink Analysis
        </div>
      </div>
    </div>
  );
};

export default EntitySEOChecker;
