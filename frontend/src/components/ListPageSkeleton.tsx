import { useMemo } from "react";

import { useTranslation } from "../hooks/useTranslation";

type ListPageSkeletonVariant = "list" | "standard-grid" | "dense-grid";

type ListPageSkeletonProps = {
  variant?: ListPageSkeletonVariant;
};

export function ListPageSkeleton({
  variant = "standard-grid",
}: ListPageSkeletonProps) {
  const { t } = useTranslation();

  const cardCount = variant === "list" ? 5 : variant === "dense-grid" ? 8 : 6;
  const items = useMemo(
    () => Array.from({ length: cardCount }, (_, index) => index),
    [cardCount],
  );

  const gridClassName =
    variant === "dense-grid"
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      : "grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3";

  return (
    <div>
      {variant === "list" ? (
        <div className="flex flex-1 flex-col gap-4 animate-pulse">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="min-w-0 space-y-2">
                    <div className="h-4 w-40 max-w-[60vw] rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-64 max-w-[70vw] rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${gridClassName} animate-pulse`}>
          {items.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="min-w-0 space-y-2">
                    <div className="h-4 w-32 max-w-[40vw] rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-[82%] rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-[64%] rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="mt-5 h-3 w-28 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
