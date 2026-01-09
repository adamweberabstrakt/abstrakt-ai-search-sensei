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

  // Brand colors
  const brandOrange = '#F46F0A';
  const bgDark = '#333333';
  const bgLight = '#EFEFEF';

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

  // Styles with new branding
  const styles = {
    container: {
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${bgDark} 0%, #2a2a2a 50%, #3d3d3d 100%)`,
      fontFamily: '"Barlow Condensed", sans-serif',
      color: bgLight,
      padding: '20px'
    },
    card: {
      background: 'rgba(239,239,239,0.08)',
      borderRadius: '12px',
      border: '1px solid rgba(239,239,239,0.15)',
      padding: '24px',
      marginBottom: '20px'
    },
    introCard: {
      background: `linear-gradient(135deg, rgba(244,111,10,0.15) 0%, rgba(244,111,10,0.08) 100%)`,
      borderRadius: '16px',
      border: `1px solid ${brandOrange}40`,
      padding: '32px',
      marginBottom: '32px'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid rgba(239,239,239,0.25)',
      background: 'rgba(0,0,0,0.4)',
      color: bgLight,
      fontSize: '15px',
      fontFamily: '"Barlow Condensed", sans-serif',
      marginTop: '8px',
      boxSizing: 'border-box'
    },
    button: {
      background: brandOrange,
      color: '#fff',
      border: 'none',
      padding: '14px 28px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '600',
      fontFamily: '"Barlow Condensed", sans-serif',
      cursor: 'pointer',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    buttonSecondary: {
      background: 'rgba(239,239,239,0.1)',
      color: bgLight,
      border: `1px solid rgba(239,239,239,0.25)`,
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: '"Barlow Condensed", sans-serif',
      cursor: 'pointer'
    },
    tab: {
      padding: '12px 20px',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      fontFamily: '"Barlow Condensed", sans-serif',
      transition: 'all 0.2s',
      border: 'none',
      marginRight: '4px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: bgDark,
      borderRadius: '16px',
      padding: '32px',
      maxWidth: '450px',
      width: '90%',
      border: `1px solid rgba(239,239,239,0.15)`
    },
    heading: {
      fontFamily: '"Barlow Condensed", sans-serif',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '1px'
    },
    ctaSection: {
      background: `linear-gradient(135deg, ${brandOrange}20 0%, ${brandOrange}10 100%)`,
      borderRadius: '16px',
      border: `2px solid ${brandOrange}`,
      padding: '32px',
      marginTop: '32px',
      textAlign: 'center'
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
      <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '24px' }}>📊 EXECUTIVE SUMMARY</h2>
      
      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: getScoreColor(getOverallScore()) }}>
            {getOverallScore()}/10
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(239,239,239,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overall AI Visibility</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: '#3b82f6', textTransform: 'capitalize' }}>
            {getOverallSentiment()}
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(239,239,239,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overall Sentiment</div>
        </div>
        {semrushData?.authorityScore !== undefined && (
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: getScoreColor(semrushData.authorityScore / 10) }}>
              {semrushData.authorityScore}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(239,239,239,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Domain Authority</div>
          </div>
        )}
        {semrushData?.backlinks && (
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#22c55e' }}>
              {semrushData.backlinks.referringDomains?.toLocaleString() || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(239,239,239,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Referring Domains</div>
          </div>
        )}
      </div>

      {/* AI Engine Breakdown */}
      <h3 style={{ ...styles.heading, marginBottom: '16px', color: bgLight, fontSize: '18px' }}>AI SEARCH ENGINE VISIBILITY</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(results.company).map(([llmId, data]) => {
          const score = data.results?.confidenceScore || 0;
          return (
            <div key={llmId} style={{ 
              background: 'rgba(0,0,0,0.4)', 
              padding: '16px', 
              borderRadius: '8px',
              borderLeft: `4px solid ${data.llm.color}`
            }}>
              <div style={{ fontSize: '12px', color: data.llm.color, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{data.llm.name}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: getScoreColor(score) }}>{score}/10</div>
            </div>
          );
        })}
      </div>

      {/* Leadership Summary */}
      {results.leadership.length > 0 && (
        <>
          <h3 style={{ ...styles.heading, marginBottom: '16px', color: bgLight, fontSize: '18px' }}>LEADERSHIP REPUTATION SUMMARY</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {results.leadership.map((leader, i) => {
              const avgScore = calculateAvgScore(leader.byLLM);
              return (
                <div key={i} style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{leader.name}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(239,239,239,0.5)', marginBottom: '8px' }}>{leader.title}</div>
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
      <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '24px' }}>🏢 COMPANY AI VISIBILITY: {results.companyName}</h2>
      
      {/* SEMRush Data */}
      {semrushData && (
        <div style={{ ...styles.card, marginBottom: '24px' }}>
          <h3 style={{ ...styles.heading, marginBottom: '16px', fontSize: '18px' }}>SEMRUSH BACKLINK PROFILE</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>{semrushData.backlinks?.total?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '11px', color: 'rgba(239,239,239,0.5)', textTransform: 'uppercase' }}>Total Backlinks</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>{semrushData.backlinks?.referringDomains?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '11px', color: 'rgba(239,239,239,0.5)', textTransform: 'uppercase' }}>Ref. Domains</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#eab308' }}>{semrushData.backlinks?.followLinks?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '11px', color: 'rgba(239,239,239,0.5)', textTransform: 'uppercase' }}>Follow Links</div>
            </div>
          </div>
          
          {semrushData.topBacklinks && semrushData.topBacklinks.length > 0 && (
            <>
              <h4 style={{ marginBottom: '8px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Referring Domains</h4>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px' }}>
                {semrushData.topBacklinks.slice(0, 5).map((link, i) => (
                  <div key={i} style={{ padding: '8px', borderBottom: i < 4 ? '1px solid rgba(239,239,239,0.1)' : 'none', fontSize: '13px' }}>
                    <span style={{ color: '#3b82f6' }}>{link.sourceUrl}</span>
                    <span style={{ color: 'rgba(239,239,239,0.5)', marginLeft: '8px' }}>(AS: {link.authorityScore})</span>
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
              background: 'rgba(0,0,0,0.4)', 
              padding: '20px', 
              borderRadius: '12px',
              borderLeft: `4px solid ${hasError ? '#ef4444' : data.llm.color}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ color: data.llm.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{data.llm.name}</strong>
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
                  <p style={{ fontSize: '14px', marginBottom: '12px', color: 'rgba(239,239,239,0.8)', lineHeight: '1.5' }}>
                    {data.results?.summary}
                  </p>
                  {data.results?.recommendations && (
                    <div style={{ background: `${brandOrange}15`, padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
                      <strong style={{ color: brandOrange }}>💡 Recommendation:</strong><br />
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
      <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '24px' }}>👤 LEADERSHIP REPUTATION & PRESS OPPORTUNITIES</h2>
      
      {results.leadership.length === 0 ? (
        <p style={{ color: 'rgba(239,239,239,0.6)' }}>No leadership team members were analyzed.</p>
      ) : (
        results.leadership.map((leader, idx) => (
          <div key={idx} style={{ ...styles.card, marginBottom: '24px' }}>
            <h3 style={{ ...styles.heading, marginBottom: '4px', fontSize: '20px' }}>{leader.name}</h3>
            <p style={{ color: 'rgba(239,239,239,0.5)', marginBottom: '16px' }}>{leader.title}</p>
            
            {/* Reputation Scores */}
            <h4 style={{ ...styles.heading, marginBottom: '12px', color: brandOrange, fontSize: '16px' }}>REPUTATION SCORES</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              {Object.entries(leader.byLLM).map(([llmId, data]) => (
                <div key={llmId} style={{
                  background: 'rgba(0,0,0,0.4)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${data.llm.color}`,
                  minWidth: '120px'
                }}>
                  <div style={{ fontSize: '11px', color: data.llm.color, textTransform: 'uppercase' }}>{data.llm.name}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: getScoreColor(data.results?.sentimentScore || 5) }}>
                    {data.results?.sentimentScore || 5}/10
                  </div>
                </div>
              ))}
            </div>

            {/* Press Opportunities */}
            <h4 style={{ ...styles.heading, marginBottom: '12px', color: brandOrange, fontSize: '16px' }}>🎤 PRESS & MEDIA OPPORTUNITIES</h4>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              {Object.entries(leader.pressOpportunities || {}).map(([llmId, data]) => (
                <div key={llmId} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: data.llm?.color, marginBottom: '8px', textTransform: 'uppercase' }}>{data.llm?.name}</div>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(239,239,239,0.8)' }}>
                    {data.results?.summary || data.results?.recommendations || 'No press opportunities found.'}
                  </p>
                  {data.results?.pressOpportunities && data.results.pressOpportunities.length > 0 && (
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      {data.results.pressOpportunities.slice(0, 5).map((opp, i) => (
                        <li key={i} style={{ fontSize: '13px', marginBottom: '4px', color: 'rgba(239,239,239,0.7)' }}>
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
      <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '24px' }}>⚔️ COMPETITOR GAP ANALYSIS</h2>
      
      {results.competitors.length === 0 ? (
        <p style={{ color: 'rgba(239,239,239,0.6)' }}>No competitors were analyzed.</p>
      ) : (
        <>
          {/* Comparison Table */}
          <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid rgba(239,239,239,0.2)` }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: brandOrange, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company</th>
                  <th style={{ padding: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Authority</th>
                  <th style={{ padding: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Backlinks</th>
                  <th style={{ padding: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ref. Domains</th>
                  <th style={{ padding: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Score</th>
                </tr>
              </thead>
              <tbody>
                {/* Your company row */}
                <tr style={{ background: `${brandOrange}15` }}>
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
                  <tr key={i} style={{ borderBottom: '1px solid rgba(239,239,239,0.1)' }}>
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
              <h3 style={{ ...styles.heading, marginBottom: '8px', fontSize: '18px' }}>{comp.name}</h3>
              {comp.website && <p style={{ color: 'rgba(239,239,239,0.5)', fontSize: '13px', marginBottom: '16px' }}>{comp.website}</p>}
              
              {comp.semrushData?.topBacklinks && comp.semrushData.topBacklinks.length > 0 && (
                <>
                  <h4 style={{ ...styles.heading, marginBottom: '8px', color: brandOrange, fontSize: '14px' }}>🔗 THEIR TOP BACKLINKS (GAP OPPORTUNITIES)</h4>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px' }}>
                    {comp.semrushData.topBacklinks.slice(0, 8).map((link, j) => (
                      <div key={j} style={{ 
                        padding: '8px 0', 
                        borderBottom: j < 7 ? '1px solid rgba(239,239,239,0.1)' : 'none',
                        fontSize: '13px'
                      }}>
                        <span style={{ color: '#3b82f6' }}>{link.sourceUrl}</span>
                        <span style={{ color: 'rgba(239,239,239,0.5)', marginLeft: '8px' }}>(AS: {link.authorityScore})</span>
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
      <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '24px' }}>🎙️ PODCAST OPPORTUNITIES</h2>
      
      {results.podcastOpportunities.length === 0 ? (
        <p style={{ color: 'rgba(239,239,239,0.6)' }}>No podcast opportunities were analyzed.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
          {results.podcastOpportunities.map((item, idx) => (
            <div key={idx} style={{ 
              background: 'rgba(0,0,0,0.4)', 
              padding: '20px', 
              borderRadius: '12px',
              borderLeft: `4px solid ${item.llm.color}`
            }}>
              <div style={{ fontSize: '12px', color: item.llm.color, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.llm.name}</div>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'rgba(239,239,239,0.8)' }}>
                {item.results?.summary || 'No summary available.'}
              </p>
              
              {item.results?.podcastOpportunities && item.results.podcastOpportunities.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommended Podcasts:</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0 }}>
                    {item.results.podcastOpportunities.map((pod, i) => (
                      <li key={i} style={{ fontSize: '13px', marginBottom: '8px', color: 'rgba(239,239,239,0.7)' }}>
                        <strong>{pod.name}</strong>
                        {pod.topic && <span> - {pod.topic}</span>}
                        {pod.audienceSize && <span style={{ color: brandOrange }}> ({pod.audienceSize} audience)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {item.results?.recommendations && (
                <div style={{ marginTop: '16px', background: `${brandOrange}15`, padding: '12px', borderRadius: '6px' }}>
                  <strong style={{ color: brandOrange, fontSize: '12px', textTransform: 'uppercase' }}>💡 Strategy:</strong>
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
      <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '24px' }}>💬 SOCIAL SENTIMENT ANALYSIS</h2>
      
      {results.leadership.length === 0 ? (
        <p style={{ color: 'rgba(239,239,239,0.6)' }}>No leadership team members were analyzed for social sentiment.</p>
      ) : (
        results.leadership.map((leader, idx) => (
          <div key={idx} style={{ ...styles.card, marginBottom: '24px' }}>
            <h3 style={{ ...styles.heading, marginBottom: '4px', fontSize: '20px' }}>{leader.name}</h3>
            <p style={{ color: 'rgba(239,239,239,0.5)', marginBottom: '16px' }}>{leader.title}</p>
            
            {/* Social Sentiment by LLM */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {Object.entries(leader.socialSentiment || {}).map(([llmId, data]) => {
                const sentimentScore = data.results?.sentimentScore || 5;
                const sentiment = data.results?.sentiment || 'neutral';
                
                return (
                  <div key={llmId} style={{ 
                    background: 'rgba(0,0,0,0.4)', 
                    padding: '16px', 
                    borderRadius: '8px',
                    borderLeft: `3px solid ${data.llm?.color}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', color: data.llm?.color, textTransform: 'uppercase' }}>{data.llm?.name}</span>
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
                    
                    <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(239,239,239,0.8)', marginBottom: '12px' }}>
                      {data.results?.summary || 'No social sentiment data available.'}
                    </p>
                    
                    {data.results?.recommendations && (
                      <div style={{ background: `${brandOrange}15`, padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                        <strong style={{ color: brandOrange }}>💡 Recommendation:</strong><br />
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

  // CTA Section for end of report
  const renderCTASection = () => (
    <div style={styles.ctaSection}>
      <h3 style={{ ...styles.heading, color: brandOrange, fontSize: '24px', marginBottom: '16px' }}>
        GET A PERSONALIZED AI SEARCH STRATEGY FROM ABSTRAKT
      </h3>
      <p style={{ fontSize: '16px', color: 'rgba(239,239,239,0.8)', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px' }}>
        Ready to improve your AI visibility and outrank your competition? Our team of experts can create a customized strategy for your business.
      </p>
      <a 
        href="https://www.abstraktmg.com/inbound-ai-visibility-tool/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          ...styles.button,
          display: 'inline-block',
          textDecoration: 'none',
          fontSize: '18px',
          padding: '16px 40px'
        }}
      >
        Get Your Personalized Strategy →
      </a>
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Google Font Import */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&display=swap');`}
      </style>
      
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header with Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '40px' }}>
          <img 
            src="/logo.png" 
            alt="Abstrakt"
            style={{ height: '60px' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h1 style={{ 
              ...styles.heading,
              fontSize: '38px', 
              color: brandOrange,
              margin: 0,
              lineHeight: 1.1
            }}>
              ABSTRAKT AI SEARCH SENSEI
            </h1>
            <p style={{ color: 'rgba(239,239,239,0.6)', fontSize: '14px', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
              AI Reputation Report • Search Visibility • Competitive Analysis
            </p>
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

        {/* Input Form (only show when no results) */}
        {!results && (
          <>
            {/* Intro Section - Why AI Search Matters */}
            <div style={styles.introCard}>
              <h2 style={{ ...styles.heading, color: brandOrange, marginBottom: '20px', fontSize: '26px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '32px' }}>🚀</span> WHY AI SEARCH MATTERS NOW
              </h2>
              <p style={{ fontSize: '17px', lineHeight: '1.8', color: 'rgba(239,239,239,0.9)', marginBottom: '20px' }}>
                AI Search is shifting how people find and purchase things online. Recent research has shown that 
                <span style={{ color: brandOrange, fontWeight: '700' }}> Google Click Thru Rate has dropped by 32% on average </span> 
                due to AI Overview and new AI platforms being used for search.
              </p>
              <p style={{ fontSize: '17px', lineHeight: '1.8', color: 'rgba(239,239,239,0.9)' }}>
                Being found online is more than your website now. It's your <strong style={{ color: brandOrange }}>entire digital footprint</strong> and 
                our tool will help you quickly find the baseline of opportunity and where to start to outrank your competition.
              </p>
            </div>

            {/* Company Information */}
            <div style={styles.card}>
              <h2 style={{ ...styles.heading, marginBottom: '20px', color: brandOrange, fontSize: '20px' }}>COMPANY INFORMATION</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Company Name *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="e.g., Abstrakt Marketing Group" style={styles.input} />
                </div>
                <div>
                  <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Website (for SEMRush data)</label>
                  <input type="text" name="website" value={formData.website} onChange={handleInputChange} placeholder="e.g., abstraktmg.com" style={styles.input} />
                </div>
                <div>
                  <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Industry</label>
                  <input type="text" name="industry" value={formData.industry} onChange={handleInputChange} placeholder="e.g., B2B Marketing" style={styles.input} />
                </div>
                <div>
                  <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Target Keywords</label>
                  <input type="text" name="keywords" value={formData.keywords} onChange={handleInputChange} placeholder="e.g., SEO, lead generation" style={styles.input} />
                </div>
              </div>
            </div>

            {/* Leadership */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ ...styles.heading, color: brandOrange, margin: 0, fontSize: '20px' }}>LEADERSHIP TEAM</h2>
                {formData.leadership.length < 5 && (
                  <button onClick={addLeadership} style={styles.buttonSecondary}>+ Add</button>
                )}
              </div>
              {formData.leadership.map((leader, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Name</label>
                    <input type="text" value={leader.name} onChange={(e) => handleLeadershipChange(i, 'name', e.target.value)} placeholder="Full name" style={styles.input} />
                  </div>
                  <div>
                    <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Title</label>
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
                <h2 style={{ ...styles.heading, color: brandOrange, margin: 0, fontSize: '20px' }}>COMPETITORS</h2>
                {formData.competitors.length < 3 && (
                  <button onClick={addCompetitor} style={styles.buttonSecondary}>+ Add</button>
                )}
              </div>
              {formData.competitors.map((comp, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <strong style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Competitor {i + 1}</strong>
                    <button onClick={() => removeCompetitor(i)} style={styles.buttonSecondary}>Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Company</label>
                      <input type="text" value={comp.name} onChange={(e) => handleCompetitorChange(i, 'name', e.target.value)} placeholder="Name" style={styles.input} />
                    </div>
                    <div>
                      <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Website</label>
                      <input type="text" value={comp.website} onChange={(e) => handleCompetitorChange(i, 'website', e.target.value)} placeholder="website.com" style={styles.input} />
                    </div>
                    <div>
                      <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Leader Name</label>
                      <input type="text" value={comp.leadership.name} onChange={(e) => handleCompetitorChange(i, 'leadership.name', e.target.value)} placeholder="CEO name" style={styles.input} />
                    </div>
                    <div>
                      <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Leader Title</label>
                      <input type="text" value={comp.leadership.title} onChange={(e) => handleCompetitorChange(i, 'leadership.title', e.target.value)} placeholder="Title" style={styles.input} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* LLM Selection */}
            <div style={styles.card}>
              <h2 style={{ ...styles.heading, marginBottom: '20px', color: brandOrange, fontSize: '20px' }}>AI SEARCH ENGINES</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {llmOptions.map(llm => (
                  <div
                    key={llm.id}
                    onClick={() => setSelectedLLMs(prev => ({ ...prev, [llm.id]: !prev[llm.id] }))}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '20px',
                      border: `2px solid ${selectedLLMs[llm.id] ? llm.color : 'rgba(239,239,239,0.25)'}`,
                      background: selectedLLMs[llm.id] ? `${llm.color}20` : 'transparent',
                      color: selectedLLMs[llm.id] ? llm.color : 'rgba(239,239,239,0.6)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {selectedLLMs[llm.id] ? '✓ ' : ''}{llm.name}
                  </div>
                ))}
              </div>
              <p style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(239,239,239,0.5)' }}>
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
                  minWidth: '280px',
                  fontSize: '18px',
                  padding: '18px 40px'
                }}
              >
                {loading ? `ANALYZING... (${progress.current}/${progress.total})` : '🔍 GENERATE AI REPUTATION REPORT'}
              </button>
              {loading && progress.message && (
                <p style={{ marginTop: '12px', color: brandOrange }}>{progress.message}</p>
              )}
            </div>
          </>
        )}

        {/* Results with Tabs */}
        {results && (
          <>
            {/* Report Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ ...styles.heading, color: brandOrange, fontSize: '32px', marginBottom: '8px' }}>
                AI REPUTATION REPORT
              </h2>
              <p style={{ color: 'rgba(239,239,239,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {results.companyName} • Generated {new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowEmailModal(true)} style={styles.button}>
                📧 EMAIL MY REPORT
              </button>
              <button onClick={() => setResults(null)} style={styles.buttonSecondary}>
                ← NEW REPORT
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '0', borderBottom: `1px solid rgba(239,239,239,0.15)` }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...styles.tab,
                    background: activeTab === tab.id ? `${brandOrange}25` : 'transparent',
                    color: activeTab === tab.id ? brandOrange : 'rgba(239,239,239,0.6)',
                    borderBottom: activeTab === tab.id ? `2px solid ${brandOrange}` : '2px solid transparent'
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

            {/* CTA Section */}
            {renderCTASection()}
          </>
        )}

        {/* Debug Logs */}
        {debugMode && debugLogs.length > 0 && (
          <div style={{ ...styles.card, background: 'rgba(0,0,0,0.6)', fontFamily: 'monospace', fontSize: '11px', maxHeight: '300px', overflow: 'auto' }}>
            <h4 style={{ color: brandOrange }}>Debug Logs</h4>
            {debugLogs.map((log, i) => (
              <div key={i} style={{ borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>[{log.ts}]</span> {log.msg}
              </div>
            ))}
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && (
          <div style={styles.modal} onClick={() => setShowEmailModal(false)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{ ...styles.heading, marginBottom: '24px', color: brandOrange, fontSize: '22px' }}>📧 EMAIL MY REPORT</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Your Name *</label>
                <input type="text" value={emailForm.name} onChange={(e) => setEmailForm(prev => ({ ...prev, name: e.target.value }))} placeholder="John Smith" style={styles.input} />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Company *</label>
                <input type="text" value={emailForm.company} onChange={(e) => setEmailForm(prev => ({ ...prev, company: e.target.value }))} placeholder="Your Company Name" style={styles.input} />
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Email Address *</label>
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
                  {emailSending ? 'SENDING...' : 'SEND REPORT'}
                </button>
                <button onClick={() => setShowEmailModal(false)} style={styles.buttonSecondary}>
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(239,239,239,0.4)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Built by Abstrakt Marketing Group | Abstrakt AI Search Sensei
        </div>
      </div>
    </div>
  );
};

export default EntitySEOChecker;
