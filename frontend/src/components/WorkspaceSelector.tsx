import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace } from "../context/WorkspaceContext";
import { useTranslation } from "../hooks/useTranslation";
import { Check, ChevronDown, Plus, Briefcase, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchWorkspaces, type Workspace } from "../api/workspaces";
import { InfiniteScroll } from "./InfiniteScroll";

type WorkspaceSelectorProps = {
  className?: string
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ className = "" }) => {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const isFa = lang === "fa";

  const [localWorkspaces, setLocalWorkspaces] = useState<Workspace[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const LIMIT = 10;

  const refreshWorkspacesList = useCallback(async () => {
    try {
      const res = await fetchWorkspaces({ offset: 0, limit: LIMIT });
      const items = Array.isArray(res) ? res : (res?.results || []);
      setLocalWorkspaces(items);
      setOffset(items.length);
      setHasMore(!Array.isArray(res) ? !!res?.next : items.length >= LIMIT);
    } catch (error) {
      console.error(error);
    }
  }, []);

 useEffect(() => {
    const handleWorkspaceDeleted = ((e: CustomEvent) => {
      if (activeWorkspace?.id === e.detail?.id) {
        setActiveWorkspace(null);
      }
      refreshWorkspacesList();
    }) as EventListener;

    const handleWorkspaceCreated = ((e: CustomEvent) => {
      if (e.detail?.id) {
        setActiveWorkspace(e.detail);
      }
      refreshWorkspacesList();
    }) as EventListener;

    const handleWorkspaceEdited = ((e: CustomEvent) => {
      if (activeWorkspace?.id === e.detail?.id) {
        setActiveWorkspace({
          ...activeWorkspace,
          ...e.detail,
        } as Workspace);
      }
      refreshWorkspacesList();
    }) as EventListener;

    window.addEventListener("workspace_deleted", handleWorkspaceDeleted);
    window.addEventListener("workspace_created", handleWorkspaceCreated);
    window.addEventListener("workspace_edited", handleWorkspaceEdited);
    
    return () => {
      window.removeEventListener("workspace_deleted", handleWorkspaceDeleted);
      window.removeEventListener("workspace_created", handleWorkspaceCreated);
      window.removeEventListener("workspace_edited", handleWorkspaceEdited);
    };
  }, [activeWorkspace, setActiveWorkspace, refreshWorkspacesList]);

  useEffect(() => {
    const ctxList = Array.isArray(workspaces) ? workspaces : (workspaces as any)?.results || [];
    setLocalWorkspaces(ctxList);
    setOffset(ctxList.length);
    if (ctxList.length > 0 && ctxList.length < LIMIT) {
      setHasMore(false);
    }
  }, [workspaces]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadMoreWorkspaces = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    
    try {
      const res = await fetchWorkspaces({ offset, limit: LIMIT });
      const newItems = Array.isArray(res) ? res : (res?.results || []);
      const nextUrl = !Array.isArray(res) ? res?.next : null;

      setLocalWorkspaces((prev) => {
        const existingIds = new Set(prev.map(w => w.id));
        const uniqueNewItems = newItems.filter((w: Workspace) => !existingIds.has(w.id));
        return [...prev, ...uniqueNewItems];
      });

      setOffset((prev) => prev + LIMIT);
      
      if (!nextUrl && newItems.length < LIMIT) {
        setHasMore(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, hasMore, isLoadingMore]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          {activeWorkspace?.thumbnail ? (
            <img src={activeWorkspace.thumbnail} alt={activeWorkspace?.name || "Workspace"} className="h-full w-full object-cover" />
          ) : (
            activeWorkspace?.name?.charAt(0)?.toUpperCase() || <Briefcase className="w-4 h-4" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-start">
          {activeWorkspace?.name || t.workspace?.title || "Workspaces"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-2 z-40 ${
            isFa ? "left-0" : "right-0"
          }`}
        >
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t.workspace?.title || "Workspaces"}
          </div>

          <div className="max-h-60 overflow-y-auto" id="workspace-scroll-container">
            <InfiniteScroll
              onLoadMore={loadMoreWorkspaces}
              hasMore={hasMore}
              isLoading={isLoadingMore}
            >
              {localWorkspaces.map((ws: Workspace) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded-md bg-slate-100 font-medium dark:bg-slate-800">
                      {ws.thumbnail ? (
                        <img src={ws.thumbnail} alt={ws.name} className="h-full w-full object-cover" />
                      ) : (
                        ws.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {activeWorkspace?.id === ws.id && (
                    <Check className="w-4 h-4 text-blue-500 shrink-0" />
                  )}
                </button>
              ))}
            </InfiniteScroll>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              navigate("/workspaces/create");
            }}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.workspace?.createNew || "Create New Workspace"}
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/workspaces');
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings className="h-4 w-4" />
            {t.workspace?.manage || "Manage Workspaces"}
          </button>
        </div>
      )}
    </div>
  );
};
