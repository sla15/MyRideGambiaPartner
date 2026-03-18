import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface DropdownProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  containerClassName?: string;
  maxHeight?: string;
  searchable?: boolean;
}

export const Dropdown = React.memo(({
  label,
  value,
  options,
  onChange,
  containerClassName = '',
  maxHeight = '230px', // Roughly 5 rows
  searchable = false
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) setSearchQuery('');
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${containerClassName}`} ref={dropdownRef}>
      <label className="text-[11px] font-bold text-slate-400 uppercase ml-2 mb-1.5 block tracking-wider">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-100 dark:bg-zinc-900 p-4 rounded-2xl border-2 transition-all ${
          isOpen ? 'border-[#00E39A] ring-2 ring-[#00E39A]/10' : 'border-transparent'
        }`}
      >
        <span className="text-[17px] font-bold text-slate-900 dark:text-white truncate">
          {selectedOption ? selectedOption.label : 'Select'}
        </span>
        <ChevronDown 
          size={18} 
          className={`text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div 
          className="absolute z-[100] left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
          style={{ maxHeight }}
        >
          {searchable && (
            <div className="p-2 border-b border-slate-50 dark:border-white/5 sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 rounded-xl">
                <Search size={14} className="text-slate-400" />
                <input 
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-900 dark:text-white w-full focus:outline-none"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto no-scrollbar flex-1 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-5 py-3.5 text-[15px] font-bold transition-colors ${
                    value === option.value 
                      ? 'bg-[#00E39A]/10 text-[#00E39A]' 
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-5 py-4 text-xs font-bold text-slate-400 text-center uppercase">
                No Results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
