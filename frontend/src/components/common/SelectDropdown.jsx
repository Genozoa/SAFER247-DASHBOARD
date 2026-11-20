import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [isClosing, setIsClosing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  // Smooth closing with exit animation
  const closeDropdown = useCallback(() => {
    if (!isOpen || isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 170);
  }, [isOpen, isClosing]);

  const openDropdown = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsClosing(false);
    setIsOpen(true);
  }, []);

  const toggleDropdown = useCallback(() => {
    if (isOpen && !isClosing) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }, [isOpen, isClosing, closeDropdown, openDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closeDropdown();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && !isClosing && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, isClosing]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        closeDropdown();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

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
    closeDropdown();
  };

  return (
    <div
      className={`select-dropdown-container ${className} ${isOpen && !isClosing ? 'is-open' : ''}`}
      ref={containerRef}
    >
      <button
        type="button"
        className={`select ${isOpen && !isClosing ? 'open' : ''}`}
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen && !isClosing}
      >
        <span className="select-text">{displayValue || placeholder}</span>
        <ChevronDown
          size={16}
          className={`select-chevron ${isOpen && !isClosing ? 'rotated' : ''}`}
        />
      </button>

      {isOpen && options.length > 0 && (
        <div
          className={`select-menu ${isClosing ? 'closing' : 'opening'}`}
          role="listbox"
        >
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
              filteredOptions.map((option, idx) => {
                const isSelected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`select-option ${isSelected ? 'selected' : ''}`}
                    style={{ '--item-idx': Math.min(idx, 12) }}
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
