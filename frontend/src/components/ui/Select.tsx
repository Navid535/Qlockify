import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../hooks/useTranslation";

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  buttonClassName?: string;
  isLoading?: boolean;
  disabled?: boolean;
  loadingText?: string;
  showChevron?: boolean;
  portalOwnerId?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  className = "",
  buttonClassName = "",
  isLoading = false,
  disabled = false,
  loadingText = "",
  showChevron = true,
  portalOwnerId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation()

  loadingText = loadingText || t.loadingText
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Calculate placement (Auto-placement + Fixed position for Portals)
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 240; // Estimated max height

      let isUpwards = false;
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        isUpwards = true;
      }

      setDropdownStyle({
        position: "fixed",
        top: isUpwards ? `${rect.top - 4}px` : `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        transform: isUpwards ? "translateY(-100%)" : "none",
        zIndex: 99999, // Ensure it's above all modals
      });
    }
  }, [isOpen]);

  // Close on window resize or scroll to avoid floating detachment
  useEffect(() => {
    const handleScrollOrResize = () => setIsOpen(false);
    if (isOpen) {
      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, true);
    }
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => String(o.value) === String(value)) || options[0];
  const isDisabled = disabled || isLoading;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="truncate">{isLoading ? loadingText : selectedOption?.label}</span>
        {isLoading ? (
          <svg className="w-4 h-4 ml-2 rtl:ml-0 rtl:mr-2 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : showChevron ? (
          <svg
            className={`w-4 h-4 ml-2 rtl:ml-0 rtl:mr-2 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        ) : null}
      </button>

      {isOpen && !isDisabled &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            data-entry-editor-owner={portalOwnerId}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 overflow-y-auto max-h-60"
          >
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(String(option.value));
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                  String(value) === String(option.value)
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {option.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
