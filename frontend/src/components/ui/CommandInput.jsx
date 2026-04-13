import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { SendIcon, CommandIcon } from './Icons';

const CommandInput = memo(({
  onSubmit,
  isProcessing,
}) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (value.trim() && !isProcessing) {
      onSubmit(value);
      setValue('');
    }
  }, [value, isProcessing, onSubmit]);

  return (
    <form 
      onSubmit={handleSubmit}
      className={`relative flex items-center gap-3 p-2 rounded-2xl border transition-all duration-500 w-[300px] ${
        isFocused ? 'border-cyan-400/50 bg-cyan-400/5 shadow-[0_0_20px_rgba(0,234,255,0.1)]' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="pl-2 opacity-40">
        <CommandIcon className="w-4 h-4" />
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Manual override..."
        className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-white placeholder:text-white/20 tracking-wide"
        disabled={isProcessing}
      />

      <button
        type="submit"
        disabled={!value.trim() || isProcessing}
        className={`p-2 rounded-xl transition-all duration-300 ${
          value.trim() && !isProcessing ? 'bg-cyan-400 text-[#0b0f1a] opacity-100' : 'bg-white/5 text-white/20 opacity-0'
        }`}
      >
        <SendIcon className="w-4 h-4" />
      </button>
    </form>
  );
});

export default CommandInput;
