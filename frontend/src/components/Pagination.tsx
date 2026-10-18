import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { Select } from './ui/Select';
import { Button } from './ui/button';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 20, 50],
}) => {
  const { t, lang } = useTranslation();
  const isFa = lang === 'fa';
  
  const toPersianNum = (num: string | number | undefined | null) => {
    if (num === null || num === undefined) return num;
    if (!isFa) return num;
    return num.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d as any]);
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  if (totalCount === 0) return null;

  const startItem = ((currentPage - 1) * limit) + 1;
  const endItem = Math.min(currentPage * limit, totalCount);
  const pageItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push("ellipsis-left");
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < totalPages - 1) {
      pages.push("ellipsis-right");
    }

    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 mt-auto -mx-4 border-t border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/95 dark:shadow-[0_-10px_30px_rgba(0,0,0,0.24)] md:-mx-6 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl gap-3 flex-row items-center justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <Select
              value={String(limit)}
              onChange={(val) => {
                onLimitChange(Number(val));
                onPageChange(1);
              }}
              options={pageSizeOptions.map((option) => ({
                value: String(option),
                label: String(toPersianNum(option)),
              }))}
              className="w-24 shrink-0"
              buttonClassName="h-9 rounded-lg border-slate-200 bg-slate-50 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:hidden">
              {toPersianNum(currentPage)} / {toPersianNum(totalPages)}
            </span>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t.pagination?.showing || 'Showing'} <strong className="text-slate-700 dark:text-slate-200">{toPersianNum(startItem)}</strong> {t.pagination?.to || '-'} <strong className="text-slate-700 dark:text-slate-200">{toPersianNum(endItem)}</strong> {t.pagination?.of || 'of'} <strong className="text-slate-700 dark:text-slate-200">{toPersianNum(totalCount)}</strong>
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <div className="hidden items-center gap-2 md:flex">
            {pageItems.map((pageItem, index) =>
              typeof pageItem === 'number' ? (
                <button
                  key={pageItem}
                  type="button"
                  onClick={() => onPageChange(pageItem)}
                  className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors',
                    pageItem === currentPage
                      ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800',
                  )}
                >
                  {toPersianNum(pageItem)}
                </button>
              ) : (
                <span
                  key={`${pageItem}-${index}`}
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              ),
            )}
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-9 rounded-lg border-slate-200 bg-slate-50 px-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t.pagination?.previous || 'Previous'}
            </Button>

            <div className="hidden text-sm font-medium text-slate-500 dark:text-slate-400 sm:block md:hidden">
              {t.pagination?.page || 'Page'} {toPersianNum(currentPage)} {t.pagination?.of || 'of'} {toPersianNum(totalPages)}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-9 rounded-lg border-slate-200 bg-slate-50 px-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t.pagination?.next || 'Next'}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
