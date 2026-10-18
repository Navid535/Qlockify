import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { Input } from "./input";

export interface MultiSearchableSelectOption {
  value: string;
  label: string;
  searchText?: string;
}

interface MultiSearchableSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  renderValue?: (selectedOptions: MultiSearchableSelectOption[]) => string;
}

export function MultiSearchableSelect({
  values,
  onChange,
  options,
  placeholder = "",
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  className = "",
  buttonClassName = "",
  renderValue,
}: MultiSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values],
  );

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.searchText || ""}`.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const displayValue = useMemo(() => {
    if (!selectedOptions.length) return placeholder;
    if (renderValue) return renderValue(selectedOptions);
    return selectedOptions.map((option) => option.label).join(", ");
  }, [placeholder, renderValue, selectedOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 320;
    const shouldOpenUp = spaceBelow < dropdownHeight && rect.top > spaceBelow;

    setDropdownStyle({
      position: "fixed",
      top: shouldOpenUp ? `${rect.top - 4}px` : `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      transform: shouldOpenUp ? "translateY(-100%)" : "none",
      zIndex: 99999,
    });
  }, [isOpen]);

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

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    onChange([...values, value]);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${buttonClassName}`}
      >
        <span className="truncate text-start">{displayValue}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="border-b border-slate-100 p-2 dark:border-slate-700">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder || "Search..."}
                  className="h-9 pl-9 rtl:pl-3 rtl:pr-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filteredOptions.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleValue(option.value)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700 ${
                      isSelected
                        ? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}

              {filteredOptions.length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {emptyLabel || "No results"}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
