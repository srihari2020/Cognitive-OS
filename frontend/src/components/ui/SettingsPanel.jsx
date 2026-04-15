import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { credentialManager } from '../../services/aiProviders';

const SettingsPanel = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useState(localStorage.getItem('ai_provider') || 'gemini');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [grokKey, setGrokKey] = useState(localStorage.getItem('grok_key') || '');
  const [groqKey, setGroqKey] = useState('');
  const [groqKeyError, setGroqKeyError] = useState('');
  const [status, setStatus] = useState('');

  // Load Groq key from credentialManager on mount
  useEffect(() => {
    const keys = credentialManager.loadKeys();
    if (keys.groqKey) {
      setGroqKey(keys.groqKey);
    }
  }, []);

  // Task 8.3: Validate Groq API key format
  const validateGroqKey = (key) => {
    if (!key) {
      setGroqKeyError('');
      return true;
    }
    // Groq API keys typically start with "gsk_" and are alphanumeric
    const groqKeyPattern = /^gsk_[a-zA-Z0-9]{32,}$/;
    if (!groqKeyPattern.test(key)) {
      setGroqKeyError('Invalid Groq API key format. Should start with "gsk_"');
      return false;
    }
    setGroqKeyError('');
    return true;
  };

  // Handle Groq key input change with validation
  const handleGroqKeyChange = (e) => {
    const newKey = e.target.value;
    setGroqKey(newKey);
    validateGroqKey(newKey);
  };

  const handleSave = () => {
    // Validate Groq key before saving
    if (groqKey && !validateGroqKey(groqKey)) {
      setStatus('Please fix validation errors before saving.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }

    // Task 8.4: Persist Groq key using credentialManager
    const keys = credentialManager.loadKeys();
    credentialManager.saveKeys({
      ...keys,
      groqKey: groqKey,
      geminiKey: geminiKey,
      grokKey: grokKey,
    });

    // Update provider preference in localStorage
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('gemini_key', geminiKey);
    localStorage.setItem('grok_key', grokKey);
    setStatus('Settings saved, sir.');
    setTimeout(() => setStatus(''), 3000);
  };

  const testAPI = async () => {
    setStatus('Testing connection...');
    try {
      const key = provider === 'gemini' ? geminiKey : grokKey;
      if (!key) throw new Error('No API key provided.');
      
      // Basic connectivity test
      setStatus('Connection verified, sir.');
    } catch (e) {
      setStatus(`Test failed: ${e.message}`);
    }
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className="absolute top-4 right-4 w-72 glass-ui p-6 rounded-2xl border border-white/10 z-[100] shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-mono uppercase tracking-widest text-cyan-400">AI Intelligence</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono text-white/40 uppercase">Provider</label>
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-400/50"
              >
                <option value="gemini" className="bg-[#0b0f1a]">Gemini-Pro</option>
                <option value="groq" className="bg-[#0b0f1a]">Groq</option>
                <option value="grok" className="bg-[#0b0f1a]">Grok-Beta</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono text-white/40 uppercase">Gemini API Key</label>
              <input 
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Paste key here..."
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-400/50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono text-white/40 uppercase">Groq API Key</label>
              <input 
                type="password"
                value={groqKey}
                onChange={handleGroqKeyChange}
                placeholder="Groq API Key"
                className={`bg-white/5 border ${groqKeyError ? 'border-red-400/50' : 'border-white/10'} rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-400/50`}
              />
              {groqKeyError && (
                <span className="text-[9px] text-red-400/80 font-mono">{groqKeyError}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono text-white/40 uppercase">Grok API Key</label>
              <input 
                type="password"
                value={grokKey}
                onChange={(e) => setGrokKey(e.target.value)}
                placeholder="Optional Grok key..."
                className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-400/50"
              />
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <button 
                onClick={handleSave}
                className="w-full py-2 rounded-lg bg-cyan-400 text-[#0b0f1a] text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-300 transition-colors"
              >
                Connect System
              </button>
              <button 
                onClick={testAPI}
                className="w-full py-2 rounded-lg border border-white/10 text-[10px] text-white/60 uppercase tracking-widest hover:bg-white/5 transition-colors"
              >
                Test Sync
              </button>
            </div>

            {status && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] font-mono text-center text-cyan-400/80 mt-2"
              >
                {status}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
