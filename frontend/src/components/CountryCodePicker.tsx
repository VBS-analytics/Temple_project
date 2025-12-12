import { useEffect, useMemo, useRef, useState } from 'react';

import { CountryOption } from '../types/country';
import { flagEmoji } from '../utils/flagEmoji';

type CountryCodePickerProps = {
  options: CountryOption[];
  selected: CountryOption;
  onSelect: (iso: CountryOption['iso']) => void;
  isFocused: boolean;
  hasError?: boolean;
  onFocus: () => void;
  onBlur: () => void;
};

export const CountryCodePicker = ({
  options,
  selected,
  onSelect,
  isFocused,
  hasError,
  onFocus,
  onBlur,
}: CountryCodePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        onBlur();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        onBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onBlur]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) {
      return options;
    }
    const term = searchTerm.toLowerCase();
    const digitTerm = term.replace(/\D/g, '');
    const strippedDigitTerm = (() => {
      const withoutLeadingZeros = digitTerm.replace(/^0+/, '');
      return withoutLeadingZeros.length ? withoutLeadingZeros : digitTerm;
    })();
    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(term);
      const codeDigits = option.code.replace(/\D/g, '');
      const codeMatch =
        option.code.includes(term) ||
        (strippedDigitTerm && codeDigits.includes(strippedDigitTerm));
      const isoMatch = option.iso.toLowerCase().includes(term);
      return labelMatch || codeMatch || isoMatch;
    });
  }, [options, searchTerm]);

  const borderClass = isFocused || hasError ? 'border-amber-500 bg-white shadow-sm' : 'border-gray-300 bg-white';

  const toggleDropdown = () => {
    if (!isOpen) {
      setSearchTerm('');
      onFocus();
      setIsOpen(true);
      return;
    }
    setIsOpen(false);
    setSearchTerm('');
    onBlur();
  };

  const handleSelect = (iso: CountryOption['iso']) => {
    onSelect(iso);
    setIsOpen(false);
    setSearchTerm('');
    onBlur();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleDropdown}
        className={`flex h-full items-center gap-2 rounded-l-xl border px-3 py-3 text-sm font-semibold transition-colors ${borderClass}`}
      >
        <span className="text-lg leading-none">{flagEmoji(selected.iso)}</span>
        <span>{selected.code}</span>
        <svg
          className="h-3 w-3 text-gray-500 transition-transform duration-200"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="p-3">
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search country or code"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto px-2 pb-2">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No matches</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.iso}
                  type="button"
                  onClick={() => handleSelect(option.iso)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 ${
                    option.iso === selected.iso ? 'bg-gray-100' : ''
                  }`}
                >
                  <span>{option.label}</span>
                  <span className="text-xs text-gray-500">{option.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
