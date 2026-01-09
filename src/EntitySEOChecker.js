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

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'company', label: 'Company', icon: '🏢' },
    { id: 'leaders', label: 'Leaders', icon: '👤' },
    { id: 'gap', label: 'Gap Analysis', icon: '⚔️' },
    { id: 'podcasts', label: 'Podcast Opportunities', icon: '🎙️' },
    { id: 'sentiment', label: 'Social Sentiment', icon: '💬' }
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
    if (formData.leadership.length < 5) {
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
      if (!response.ok) return null;
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
    setActiveTab('overview');

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
      industry: formData.industry,
      company: {},
      leadership: [],
      competitors: [],
      semrushData: null,
      podcastOpportunities: [],
      socialSentiment: []
    };

    try {
      // Calculate total queries
      const leaderCount = formData.leadership.filter(l => l.name).length;
      const competitorCount = formData.competitors.filter(c => c.name).length;
      let totalQueries = selectedLLMList.length; // company
      totalQueries += selectedLLMList.length * leaderCount; // leadership
      totalQueries += selectedLLMList.length * leaderCount; // leadership press opportunities
      totalQueries += selectedLLMList.length * leaderCount; // social sentiment
      totalQueries += selectedLLMList.length * competitorCount; // competitors
      totalQueries += selectedLLMList.length; // podcast opportunities
      
      let currentQuery = 0;

      // Fetch SEMRush data for main company
      if (formData.website) {
        setProgress({ current: 0, total: totalQueries, message: 'Fetching SEMRush data...' });
        const mainSemrush = await fetchSemrushData(formData.website);
        allResults.semrushData = mainSemrush?.data || null;
        setSemrushData(mainSemrush?.data || null);
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

      // Analyze leadership (reputation + press opportunities + social sentiment)
      for (const leader of formData.leadership.filter(l => l.name)) {
        const leaderResults = { 
          name: leader.name, 
          title: leader.title, 
          byLLM: {},
          pressOpportunities: {},
          socialSentiment: {}
        };
        
        for (const llm of selectedLLMList) {
          // Leadership reputation
          currentQuery++;
          setProgress({ 
            current: currentQuery, 
            total: totalQueries, 
            message: `Analyzing ${leader.name}'s reputation on ${llm.name}...` 
          });
          
          const query = `Tell me about ${leader.name}${leader.title ? `, ${leader.title}` : ''} at ${formData.companyName}. What is their reputation, thought leadership, and online presence?`;
          const result = await analyzeQuery(query, llm.name, 'leadership');
          leaderResults.byLLM[llm.id] = { llm, results: result };

          // Press opportunities for this leader
          currentQuery++;
          setProgress({ 
            current: currentQuery, 
            total: totalQueries, 
            message: `Finding press opportunities for ${leader.name}...` 
          });
          
          const pressQuery = `What press opportunities, media outlets, industry publications, and speaking engagements would be good for ${leader.name}${leader.title ? `, ${leader.title}` : ''} at ${formData.companyName}${formData.industry ? ` in the ${formData.industry} industry` : ''}? Focus on publications and outlets where they could contribute articles, be interviewed, or be featured.`;
          const pressResult = await analyzeQuery(pressQuery, llm.name, 'press');
          leaderResults.pressOpportunities[llm.id] = { llm, results: pressResult };

          // Social sentiment analysis
          currentQuery++;
          setProgress({ 
            current: currentQuery, 
            total: totalQueries, 
            message: `Analyzing social sentiment for ${leader.name}...` 
          });
          
          const socialQuery = `Analyze the social media sentiment and online reputation of ${leader.name}${leader.title ? `, ${leader.title}` : ''} at ${formData.companyName}. Look at LinkedIn presence, Twitter/X mentions, industry forums, and any social media discussions. What is the overall sentiment? Are there any concerns or particularly positive mentions?`;
          const socialResult = await analyzeQuery(socialQuery, llm.name, 'social');
          leaderResults.socialSentiment[llm.id] = { llm, results: socialResult };
        }
        
        allResults.leadership.push(leaderResults);
      }

      // Podcast opportunities
      for (const llm of selectedLLMList) {
        currentQuery++;
        setProgress({ 
          current: currentQuery, 
          total: totalQueries, 
          message: `Finding podcast opportunities on ${llm.name}...` 
        });
        
        const podcastQuery = `What podcasts would be good for executives from ${formData.companyName}${formData.industry ? ` in the ${formData.industry} industry` : ''} to appear on as guests? List specific podcasts with their audience size, topics covered, and why they would be a good fit. Include both industry-specific podcasts and broader business podcasts.`;
        const podcastResult = await analyzeQuery(podcastQuery, llm.name, 'podcast');
        allResults.podcastOpportunities.push({ llm, results: podcastResult });
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
      .map(r => r.results?.confidenceScore || r.results?.sentimentScore || 0)
      .filter(s => s > 0);
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  const getOverallScore = () => {
    if (!results?.company) return 0;
    return calculateAvgScore(results.company);
  };

  const getOverallSentiment = () => {
    if (!results?.company) return 'N/A';
    const sentiments = Object.values(results.company)
      .map(r => r.results?.sentiment)
      .filter(Boolean);
    if (sentiments.length === 0) return 'N/A';
    const counts = { positive: 0, neutral: 0, negative: 0 };
    sentiments.forEach(s => counts[s.toLowerCase()] = (counts[s.toLowerCase()] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
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
    introCard: {
      background: 'linear-gradient(135deg, rgba(232,93,4,0.15) 0%, rgba(244,140,6,0.1) 100%)',
      borderRadius: '16px',
      border: '1px solid rgba(244,140,6,0.3)',
      padding: '32px',
      marginBottom: '32px'
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
    tab: {
      padding: '12px 20px',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s',
      border: 'none',
      marginRight: '4px'
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
    },
    statHighlight: {
      color: '#F48C06',
      fontWeight: '700'
    }
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'company':
        return renderCompanyTab();
      case 'leaders':
        return renderLeadersTab();
      case 'gap':
        return renderGapAnalysisTab();
      case 'podcasts':
        return renderPodcastsTab();
      case 'sentiment':
        return renderSentimentTab();
      default:
        return null;
    }
  };

  // Overview Tab
  const renderOverviewTab = () => (
    <div>
      <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>📊 Executive Summary</h2>
      
      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: getScoreColor(getOverallScore()) }}>
            {getOverallScore()}/10
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Overall AI Visibility</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#3b82f6', textTransform: 'capitalize' }}>
            {getOverallSentiment()}
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Overall Sentiment</div>
        </div>
        {semrushData?.authorityScore !== undefined && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: getScoreColor(semrushData.authorityScore / 10) }}>
              {semrushData.authorityScore}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Domain Authority</div>
          </div>
        )}
        {semrushData?.backlinks && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#22c55e' }}>
              {semrushData.backlinks.referringDomains?.toLocaleString() || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Referring Domains</div>
          </div>
        )}
      </div>

      {/* AI Engine Breakdown */}
      <h3 style={{ marginBottom: '16px', color: '#fff' }}>AI Search Engine Visibility</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(results.company).map(([llmId, data]) => {
          const score = data.results?.confidenceScore || 0;
          return (
            <div key={llmId} style={{ 
              background: 'rgba(0,0,0,0.3)', 
              padding: '16px', 
              borderRadius: '8px',
              borderLeft: `4px solid ${data.llm.color}`
            }}>
              <div style={{ fontSize: '12px', color: data.llm.color, marginBottom: '4px' }}>{data.llm.name}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: getScoreColor(score) }}>{score}/10</div>
            </div>
          );
        })}
      </div>

      {/* Leadership Summary */}
      {results.leadership.length > 0 && (
        <>
          <h3 style={{ marginBottom: '16px', color: '#fff' }}>Leadership Reputation Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {results.leadership.map((leader, i) => {
              const avgScore = calculateAvgScore(leader.byLLM);
              return (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{leader.name}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{leader.title}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: getScoreColor(avgScore) }}>{avgScore}/10</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // Company Tab
  const renderCompanyTab = () => (
    <div>
      <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>🏢 Company AI Visibility: {results.companyName}</h2>
      
      {/* SEMRush Data */}
      {semrushData && (
        <div style={{ ...styles.card, marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>SEMRush Backlink Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>{semrushData.backlinks?.total?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Total Backlinks</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>{semrushData.backlinks?.referringDomains?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Ref. Domains</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#eab308' }}>{semrushData.backlinks?.followLinks?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Follow Links</div>
            </div>
          </div>
          
          {semrushData.topBacklinks && semrushData.topBacklinks.length > 0 && (
            <>
              <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Top Referring Domains</h4>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px' }}>
                {semrushData.topBacklinks.slice(0, 5).map((link, i) => (
                  <div key={i} style={{ padding: '8px', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.1)' : 'none', fontSize: '13px' }}>
                    <span style={{ color: '#3b82f6' }}>{link.sourceUrl}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}>(AS: {link.authorityScore})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* LLM Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
        {Object.entries(results.company).map(([llmId, data]) => {
          const score = data.results?.confidenceScore || 0;
          const hasError = data.results?.error;
          
          return (
            <div key={llmId} style={{ 
              background: 'rgba(0,0,0,0.3)', 
              padding: '20px', 
              borderRadius: '12px',
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
                  <p style={{ fontSize: '14px', marginBottom: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>
                    {data.results?.summary}
                  </p>
                  {data.results?.recommendations && (
                    <div style={{ background: 'rgba(248,140,6,0.1)', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                      <strong style={{ color: '#F48C06' }}>💡 Recommendation:</strong><br />
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
  );

  // Leaders Tab
  const renderLeadersTab = () => (
    <div>
      <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>👤 Leadership Reputation & Press Opportunities</h2>
      
      {results.leadership.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>No leadership team members were analyzed.</p>
      ) : (
        results.leadership.map((leader, idx) => (
          <div key={idx} style={{ ...styles.card, marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '4px' }}>{leader.name}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>{leader.title}</p>
            
            {/* Reputation Scores */}
            <h4 style={{ marginBottom: '12px', color: '#F48C06' }}>Reputation Scores</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              {Object.entries(leader.byLLM).map(([llmId, data]) => (
                <div key={llmId} style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${data.llm.color}`,
                  minWidth: '120px'
                }}>
                  <div style={{ fontSize: '11px', color: data.llm.color }}>{data.llm.name}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: getScoreColor(data.results?.sentimentScore || 5) }}>
                    {data.results?.sentimentScore || 5}/10
                  </div>
                </div>
              ))}
            </div>

            {/* Press Opportunities */}
            <h4 style={{ marginBottom: '12px', color: '#F48C06' }}>🎤 Press & Media Opportunities</h4>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              {Object.entries(leader.pressOpportunities || {}).map(([llmId, data]) => (
                <div key={llmId} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: data.llm?.color, marginBottom: '8px' }}>{data.llm?.name}</div>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)' }}>
                    {data.results?.summary || data.results?.recommendations || 'No press opportunities found.'}
                  </p>
                  {data.results?.pressOpportunities && data.results.pressOpportunities.length > 0 && (
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      {data.results.pressOpportunities.slice(0, 5).map((opp, i) => (
                        <li key={i} style={{ fontSize: '13px', marginBottom: '4px', color: 'rgba(255,255,255,0.7)' }}>
                          <strong>{opp.outlet}</strong> - {opp.type}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // Gap Analysis Tab
  const renderGapAnalysisTab = () => (
    <div>
      <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>⚔️ Competitor Gap Analysis</h2>
      
      {results.competitors.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>No competitors were analyzed.</p>
      ) : (
        <>
          {/* Comparison Table */}
          <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
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

          {/* Competitor Details & Backlink Gaps */}
          {results.competitors.map((comp, i) => (
            <div key={i} style={{ ...styles.card, marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '8px' }}>{comp.name}</h3>
              {comp.website && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>{comp.website}</p>}
              
              {comp.semrushData?.topBacklinks && comp.semrushData.topBacklinks.length > 0 && (
                <>
                  <h4 style={{ marginBottom: '8px', color: '#F48C06' }}>🔗 Their Top Backlinks (Gap Opportunities)</h4>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                    {comp.semrushData.topBacklinks.slice(0, 8).map((link, j) => (
                      <div key={j} style={{ 
                        padding: '8px 0', 
                        borderBottom: j < 7 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        fontSize: '13px'
                      }}>
                        <span style={{ color: '#3b82f6' }}>{link.sourceUrl}</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}>(AS: {link.authorityScore})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );

  // Podcasts Tab
  const renderPodcastsTab = () => (
    <div>
      <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>🎙️ Podcast Opportunities</h2>
      
      {results.podcastOpportunities.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>No podcast opportunities were analyzed.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
          {results.podcastOpportunities.map((item, idx) => (
            <div key={idx} style={{ 
              background: 'rgba(0,0,0,0.3)', 
              padding: '20px', 
              borderRadius: '12px',
              borderLeft: `4px solid ${item.llm.color}`
            }}>
              <div style={{ fontSize: '12px', color: item.llm.color, marginBottom: '12px' }}>{item.llm.name}</div>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)' }}>
                {item.results?.summary || 'No summary available.'}
              </p>
              
              {item.results?.podcastOpportunities && item.results.podcastOpportunities.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Recommended Podcasts:</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    {item.results.podcastOpportunities.map((pod, i) => (
                      <li key={i} style={{ fontSize: '13px', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>
                        <strong>{pod.name}</strong>
                        {pod.topic && <span> - {pod.topic}</span>}
                        {pod.audienceSize && <span style={{ color: '#F48C06' }}> ({pod.audienceSize} audience)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {item.results?.recommendations && (
                <div style={{ marginTop: '16px', background: 'rgba(248,140,6,0.1)', padding: '12px', borderRadius: '6px' }}>
                  <strong style={{ color: '#F48C06', fontSize: '12px' }}>💡 Strategy:</strong>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>{item.results.recommendations}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Social Sentiment Tab
  const renderSentimentTab = () => (
    <div>
      <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>💬 Social Sentiment Analysis</h2>
      
      {results.leadership.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>No leadership team members were analyzed for social sentiment.</p>
      ) : (
        results.leadership.map((leader, idx) => (
          <div key={idx} style={{ ...styles.card, marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '4px' }}>{leader.name}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>{leader.title}</p>
            
            {/* Social Sentiment by LLM */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {Object.entries(leader.socialSentiment || {}).map(([llmId, data]) => {
                const sentimentScore = data.results?.sentimentScore || 5;
                const sentiment = data.results?.sentiment || 'neutral';
                
                return (
                  <div key={llmId} style={{ 
                    background: 'rgba(0,0,0,0.3)', 
                    padding: '16px', 
                    borderRadius: '8px',
                    borderLeft: `3px solid ${data.llm?.color}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', color: data.llm?.color }}>{data.llm?.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '18px',
                          fontWeight: '700',
                          color: getScoreColor(sentimentScore)
                        }}>
                          {sentimentScore}/10
                        </span>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          background: sentiment === 'positive' ? 'rgba(34,197,94,0.2)' : sentiment === 'negative' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                          color: sentiment === 'positive' ? '#22c55e' : sentiment === 'negative' ? '#ef4444' : '#eab308'
                        }}>
                          {sentiment}
                        </span>
                      </div>
                    </div>
                    
                    <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)', marginBottom: '12px' }}>
                      {data.results?.summary || 'No social sentiment data available.'}
                    </p>
                    
                    {data.results?.recommendations && (
                      <div style={{ background: 'rgba(248,140,6,0.1)', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                        <strong style={{ color: '#F48C06' }}>💡 Recommendation:</strong><br />
                        {data.results.recommendations}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header with Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ marginBottom: '16px' }}>
            <img 
              src="https://www.abstraktmg.com/wp-content/uploads/2023/05/Abstrakt-logo-white-transparent.png" 
              alt="Abstrakt Marketing Group"
              style={{ height: '50px', marginBottom: '8px' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 style={{ 
            fontSize: '36px', 
            fontWeight: '700',
            background: 'linear-gradient(90deg, #E85D04, #F48C06)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px'
          }}>
            Abstrakt AI Search Sensei
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px' }}>
            AI Reputation Report • Search Visibility • Competitive Analysis
          </p>
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

        {/* Input Form (only show when no results) */}
        {!results && (
          <>
            {/* Intro Section - Why AI Search Matters */}
            <div style={styles.introCard}>
              <h2 style={{ color: '#F48C06', marginBottom: '20px', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>🚀</span> Why AI Search Matters Now
              </h2>
              <p style={{ fontSize: '17px', lineHeight: '1.8', color: 'rgba(255,255,255,0.9)', marginBottom: '20px' }}>
                AI Search is shifting how people find and purchase things online. Recent research has shown that 
                <span style={styles.statHighlight}> Google Click Thru Rate has dropped by 32% on average </span> 
                due to AI Overview and new AI platforms being used for search.
              </p>
              <p style={{ fontSize: '17px', lineHeight: '1.8', color: 'rgba(255,255,255,0.9)' }}>
                Being found online is more than your website now. It's your <strong style={{ color: '#F48C06' }}>entire digital footprint</strong> and 
                our tool will help you quickly find the baseline of opportunity and where to start to outrank your competition.
              </p>
            </div>

            {/* Company Information */}
            <div style={styles.card}>
              <h2 style={{ marginBottom: '20px', color: '#F48C06' }}>Company Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div>
                  <label>Company Name *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="e.g., Abstrakt Marketing Group" style={styles.input} />
                </div>
                <div>
                  <label>Website (for SEMRush data)</label>
                  <input type="text" name="website" value={formData.website} onChange={handleInputChange} placeholder="e.g., abstraktmg.com" style={styles.input} />
                </div>
                <div>
                  <label>Industry</label>
                  <input type="text" name="industry" value={formData.industry} onChange={handleInputChange} placeholder="e.g., B2B Marketing" style={styles.input} />
                </div>
                <div>
                  <label>Target Keywords</label>
                  <input type="text" name="keywords" value={formData.keywords} onChange={handleInputChange} placeholder="e.g., SEO, lead generation" style={styles.input} />
                </div>
              </div>
            </div>

            {/* Leadership */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#F48C06', margin: 0 }}>Leadership Team</h2>
                {formData.leadership.length < 5 && (
                  <button onClick={addLeadership} style={styles.buttonSecondary}>+ Add</button>
                )}
              </div>
              {formData.leadership.map((leader, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'end' }}>
                  <div>
                    <label>Name</label>
                    <input type="text" value={leader.name} onChange={(e) => handleLeadershipChange(i, 'name', e.target.value)} placeholder="Full name" style={styles.input} />
                  </div>
                  <div>
                    <label>Title</label>
                    <input type="text" value={leader.title} onChange={(e) => handleLeadershipChange(i, 'title', e.target.value)} placeholder="Job title" style={styles.input} />
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
                <h2 style={{ color: '#F48C06', margin: 0 }}>Competitors</h2>
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
                  minWidth: '260px',
                  fontSize: '18px',
                  padding: '18px 36px'
                }}
              >
                {loading ? `Analyzing... (${progress.current}/${progress.total})` : '🔍 Generate AI Reputation Report'}
              </button>
              {loading && progress.message && (
                <p style={{ marginTop: '12px', color: '#F48C06' }}>{progress.message}</p>
              )}
            </div>
          </>
        )}

        {/* Results with Tabs */}
        {results && (
          <>
            {/* Report Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#F48C06', fontSize: '28px', marginBottom: '8px' }}>
                AI Reputation Report
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                {results.companyName} • Generated {new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowEmailModal(true)} style={styles.button}>
                📧 Email My Report
              </button>
              <button onClick={() => setResults(null)} style={styles.buttonSecondary}>
                ← New Report
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...styles.tab,
                    background: activeTab === tab.id ? 'rgba(248,140,6,0.2)' : 'transparent',
                    color: activeTab === tab.id ? '#F48C06' : 'rgba(255,255,255,0.6)',
                    borderBottom: activeTab === tab.id ? '2px solid #F48C06' : '2px solid transparent'
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ ...styles.card, borderTopLeftRadius: 0 }}>
              {renderTabContent()}
            </div>
          </>
        )}

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

        {/* Email Modal */}
        {showEmailModal && (
          <div style={styles.modal} onClick={() => setShowEmailModal(false)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: '24px', color: '#F48C06' }}>📧 Email My Report</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label>Your Name *</label>
                <input type="text" value={emailForm.name} onChange={(e) => setEmailForm(prev => ({ ...prev, name: e.target.value }))} placeholder="John Smith" style={styles.input} />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label>Company *</label>
                <input type="text" value={emailForm.company} onChange={(e) => setEmailForm(prev => ({ ...prev, company: e.target.value }))} placeholder="Your Company Name" style={styles.input} />
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label>Email Address *</label>
                <input type="email" value={emailForm.email} onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))} placeholder="you@company.com" style={styles.input} />
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
                <button onClick={sendEmailReport} disabled={emailSending} style={{ ...styles.button, flex: 1, opacity: emailSending ? 0.5 : 1 }}>
                  {emailSending ? 'Sending...' : 'Send Report'}
                </button>
                <button onClick={() => setShowEmailModal(false)} style={styles.buttonSecondary}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          Built by Abstrakt Marketing Group | Abstrakt AI Search Sensei
        </div>
      </div>
    </div>
  );
};

export default EntitySEOChecker;
