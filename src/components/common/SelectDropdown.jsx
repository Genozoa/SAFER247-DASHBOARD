import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export default function SelectDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  children,
  className = '',
  searchable = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const displayValue = value !== undefined ? value : children;

  const filteredOptions = options.filter((opt) =>
    typeof opt === 'string'
      ? opt.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const handleSelect = (option) => {
    if (onChange) {
      onChange(option);
    }
    setIsOpen(false);
  };

  return (
    <div
      className={`select-dropdown-container ${className}`}
      ref={containerRef}
    >
      <button
        type="button"
        className={`select ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="select-text">{displayValue || placeholder}</span>
        <ChevronDown
          size={16}
          className={`select-chevron ${isOpen ? 'rotated' : ''}`}
        />
      </button>

      {isOpen && options.length > 0 && (
        <div className="select-menu" role="listbox">
          {searchable && options.length > 7 && (
            <div className="select-search">
              <Search size={13} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="select-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(option)}
                  >
                    <span>{option}</span>
                    {isSelected && <Check size={14} className="option-check" />}
                  </button>
                );
              })
            ) : (
              <div className="select-empty">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
