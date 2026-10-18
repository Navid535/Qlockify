import { useEffect, useState } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { Select } from './ui/Select';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  ordering: string;
  setOrdering: (val: string) => void;
  orderingOptions: { value: string; label: string }[];
  searchPlaceholder: string;
}

export default function FilterBar({
  searchQuery,
  setSearchQuery,
  ordering,
  setOrdering,
  orderingOptions,
  searchPlaceholder
}: FilterBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);

  useEffect(() => {
    if (inputValue === searchQuery) return;

    const timeout = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [inputValue, searchQuery, setSearchQuery]);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={searchPlaceholder || "Search..."}
          className="w-full pl-10 pr-4 rtl:pl-4 rtl:pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <ArrowUpDown className="h-5 w-5 text-slate-400 hidden sm:block" />

        <Select
          value={ordering}
          onChange={setOrdering}
          options={orderingOptions}
          className="w-full sm:w-max"
          buttonClassName="w-full whitespace-nowrap sm:min-w-[150px]"
        />
      </div>
    </div>
  );
}