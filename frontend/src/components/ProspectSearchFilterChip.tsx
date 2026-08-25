'use client';

import React, { useEffect, useRef } from 'react';
import { LucideIcon, X } from 'lucide-react';

interface ProspectSearchFilterChipProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isOpen: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onClose: () => void;
  onClear?: () => void;
  children: React.ReactNode;
}

export default function ProspectSearchFilterChip({
  label,
  icon: Icon,
  isActive,
  isOpen,
  disabled,
  onToggle,
  onClose,
  onClear,
  children,
}: ProspectSearchFilterChipProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border pl-3 pr-1.5 py-1.5 text-xs font-semibold transition ${
          isActive
            ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-200'
            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon size={13} aria-hidden="true" />
          {label}
        </button>
        {isActive && onClear && !disabled && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            aria-label={`Clear ${label} filter`}
            className="ml-1 rounded-full p-0.5 text-indigo-300/70 transition hover:bg-white/10 hover:text-white"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </span>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-[#0f172a] p-3 shadow-2xl">
          {children}
        </div>
      )}
    </div>
  );
}
