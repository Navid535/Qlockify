import React, { useEffect, useRef } from "react";
import { useTranslation } from "../hooks/useTranslation";

interface InfiniteScrollProps {
  children: React.ReactNode;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  className?: string;
  loader?: React.ReactNode;
}

export const InfiniteScroll: React.FC<InfiniteScrollProps> = ({
  children,
  onLoadMore,
  hasMore,
  isLoading,
  className = "",
  loader,
}) => {
  const { t } = useTranslation();
  const observerTarget = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
    hasMoreRef.current = hasMore;
    isLoadingRef.current = isLoading;
  }, [onLoadMore, hasMore, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !isLoadingRef.current) {
          onLoadMoreRef.current();
        }
      },
      { 
        root: null, 
        rootMargin: "200px",
        threshold: 0 
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      {children}
      <div ref={observerTarget} className={`h-4 w-full ${!hasMore ? 'hidden' : ''}`} />
      
      {isLoading && (
        loader || (
          <div className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
            {t.loading || "Loading..."}
          </div>
        )
      )}
    </div>
  );
};
