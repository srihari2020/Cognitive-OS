import React, { useState, useRef, useEffect, memo } from 'react';
import { Command, ArrowRight } from 'lucide-react';
import { useUI } from '../context/UIContext';

const InputBox = memo(({
  value,
  onChange,
  onSend,
  isProcessing,
  isListening,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [isProcessing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim() && !isProcessing) {
      onSend(value);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 glass-ui input-focus-glow ${
        isFocused
          ? 'bg-white/10 scale-[1.01]'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <Command size={18} className={`transition-colors ${isFocused ? 'text-cyan-400' : 'text-white/20'}`} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isListening ? "Listening..." : isProcessing ? "Processing..." : "Type a command..."}
        disabled={isProcessing}
        className="flex-1 bg-transparent font-rajdhani text-[15px] font-medium text-[#e6f1ff] placeholder-white/20 outline-none"
      />
      <button
        type="submit"
        disabled={!value.trim() || isProcessing}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 futuristic-button ${
          value.trim() && !isProcessing
            ? 'bg-cyan-400 text-[#0b0f1a]'
            : 'bg-white/5 text-white/20'
        }`}
      >
        <ArrowRight size={18} />
      </button>
    </form>
  );
});

export default InputBox;
