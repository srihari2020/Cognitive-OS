
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Save, Shield, Cpu, Key, Check, AlertCircle } from 'lucide-react';
import { credentialManager, providers } from '../services/aiProviders';
import { aiRouter } from '../services/aiRouter';

export default function SettingsPanel({ isOpen, onClose }) {
  const [keys, setKeys] = useState({ OpenAI: '', Gemini: '', Claude: '' });
  const [activeProvider, setActiveProvider] = useState('OpenAI');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null

  useEffect(() => {
    if (isOpen) {
      const storedKeys = credentialManager.loadKeys();
      setKeys(prev => ({ ...prev, ...storedKeys }));
      const savedProvider = localStorage.getItem('active_ai_provider') || 'OpenAI';
      setActiveProvider(savedProvider);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      credentialManager.saveKeys(keys);
      await aiRouter.initialize(activeProvider);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
    >
      <div className="w-full max-w-lg bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-purple-400" />
            <h2 className="text-sm font-semibold tracking-wider text-white uppercase">Neural Core Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
          {/* Provider Selection */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={16} className="text-blue-400" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Intelligence</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(providers).map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveProvider(name)}
                  className={`px-4 py-3 rounded-xl border text-xs font-medium transition-all duration-200 flex flex-col items-center gap-2 ${
                    activeProvider === name 
                      ? 'bg-purple-500/20 border-purple-500/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span className={activeProvider === name ? 'text-purple-300' : 'text-gray-500'}>
                    {name === 'OpenAI' ? 'GPT-4' : name === 'Gemini' ? 'Ultra' : 'Claude 3'}
                  </span>
                  {name}
                </button>
              ))}
            </div>
          </section>

          {/* API Keys */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-red-400" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Secure Credentials</h3>
            </div>
            <div className="space-y-4">
              {Object.keys(providers).map((name) => (
                <div key={name} className="space-y-1.5">
                  <label className="text-[10px] font-medium text-gray-500 uppercase ml-1">{name} API Key</label>
                  <div className="relative group">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-400 transition-colors" size={14} />
                    <input
                      type="password"
                      value={keys[name] || ''}
                      onChange={(e) => setKeys(prev => ({ ...prev, [name]: e.target.value }))}
                      placeholder={`sk-...${name.toLowerCase().substring(0, 3)}`}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 italic leading-relaxed px-1">
              Keys are stored locally and never exposed in system logs. Ensure your keys have sufficient quota for real-time operations.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {saveStatus === 'success' && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-green-400 text-[11px] font-medium"
                >
                  <Check size={14} /> Neural core updated
                </motion.div>
              )}
              {saveStatus === 'error' && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-red-400 text-[11px] font-medium"
                >
                  <AlertCircle size={14} /> Failed to save
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
              isSaving 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-purple-500 hover:text-white'
            }`}
          >
            {isSaving ? 'Processing...' : (
              <>
                <Save size={14} /> Synchronize
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
