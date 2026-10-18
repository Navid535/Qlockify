import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BriefcaseBusiness, CalendarRange, Check, FolderKanban, Search, SlidersHorizontal, Tag as TagIcon, X } from "lucide-react";

import type { Project } from "../../api/projects";
import type { Tag } from "../../api/tags";
import JalaliDatePicker from "../ui/JalaliDatePicker";
import { Select } from "../ui/Select";

export interface TimeEntryFilters {
  projectId: string;
  clientId: string;
  tagIds: string[];
  startedAfter: string;
  startedBefore: string;
}

interface TimesheetFilterBarProps {
  searchQuery: string;
  filters: TimeEntryFilters;
  onSearchChange: (value: string) => void;
  onApply: (filters: TimeEntryFilters) => void;
  onClearFilters: () => void;
  projects: Project[];
  tags: Tag[];
  searchPlaceholder: string;
  labels?: {
    project?: string;
    client?: string;
    tags?: string;
    clear?: string;
    customFrom?: string;
    customTo?: string;
    allClients?: string;
    allProjects?: string;
    allTags?: string;
    showFilters?: string;
    hideFilters?: string;
    apply?: string;
    clientPrefix?: string;
    projectPrefix?: string;
    tagPrefix?: string;
    fromPrefix?: string;
    toPrefix?: string;
    searchTags?: string;
    noTagsFound?: string;
  };
}

const normalizeOptionId = (value: unknown) => (value === null || value === undefined ? "" : String(value));

function FilterTagMultiSelect({
  tags,
  selectedTagIds,
  onChange,
  title,
  searchPlaceholder,
  emptyLabel,
}: {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 260);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 280 && rect.top > spaceBelow;

    setDropdownStyle({
      position: "fixed",
      top: openUpward ? `${rect.top - 6}px` : `${rect.bottom + 6}px`,
      left: `${Math.max(12, rect.right - dropdownWidth)}px`,
      width: `${dropdownWidth}px`,
      transform: openUpward ? "translateY(-100%)" : "none",
      zIndex: 100000,
    });
  }, [isOpen]);

  useEffect(() => {
    const closeOnViewportChange = () => setIsOpen(false);
    if (isOpen) {
      window.addEventListener("resize", closeOnViewportChange);
      window.addEventListener("scroll", closeOnViewportChange, true);
    }
    return () => {
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const normalizedSelectedTagIds = selectedTagIds.map(normalizeOptionId).filter(Boolean);
  const selectedTagIdSet = new Set(normalizedSelectedTagIds);
  const selectedTags = tags.filter((tag) => selectedTagIdSet.has(normalizeOptionId(tag.id)));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTags = normalizedSearch
    ? tags.filter((tag) => tag.name.toLowerCase().includes(normalizedSearch))
    : tags;
  const label = selectedTags.length > 0 ? selectedTags.map((tag) => tag.name).join(" | ") : title;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-8 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600"
      >
        <TagIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="truncate">{label}</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="border-b border-slate-200 p-2 dark:border-slate-700">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800"
                />
              </div>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto p-2">
              {filteredTags.map((tag) => {
                const tagId = normalizeOptionId(tag.id);
                const selected = selectedTagIdSet.has(tagId);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      onChange(
                        selected
                          ? normalizedSelectedTagIds.filter((currentTagId) => currentTagId !== tagId)
                          : [...normalizedSelectedTagIds, tagId],
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      selected
                        ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 truncate">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color || "#94A3B8" }} />
                      <span className="truncate">{tag.name}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
              {filteredTags.length === 0 && (
                <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {emptyLabel}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MiniFilterBlock({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export default function TimesheetFilterBar({
  searchQuery,
  filters,
  onSearchChange,
  onApply,
  onClearFilters,
  projects,
  tags,
  searchPlaceholder,
  labels,
}: TimesheetFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TimeEntryFilters>(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const clients = useMemo(
    () =>
      Array.from(
        new Map(
          projects
            .filter((project) => project.client)
            .map((project) => [project.client!.id, { value: project.client!.id, label: project.client!.name }]),
        ).values(),
      ),
    [projects],
  );

  const selectedClient = clients.find((client) => normalizeOptionId(client.value) === normalizeOptionId(filters.clientId)) || null;
  const selectedProject = projects.find((project) => normalizeOptionId(project.id) === normalizeOptionId(filters.projectId)) || null;
  const selectedTagIdSet = new Set(filters.tagIds.map(normalizeOptionId));
  const selectedTags = tags.filter((tag) => selectedTagIdSet.has(normalizeOptionId(tag.id)));

  const activeChips = [
    filters.startedAfter ? `${labels?.fromPrefix || labels?.customFrom || "From"}: ${filters.startedAfter}` : null,
    filters.startedBefore ? `${labels?.toPrefix || labels?.customTo || "To"}: ${filters.startedBefore}` : null,
    selectedClient ? `${labels?.clientPrefix || labels?.client || "Client"}: ${selectedClient.label}` : null,
    selectedProject ? `${labels?.projectPrefix || labels?.project || "Project"}: ${selectedProject.name}` : null,
    ...selectedTags.map((tag) => `${labels?.tagPrefix || labels?.tags || "Tag"}: ${tag.name}`),
  ].filter(Boolean) as string[];

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      filters.clientId ||
      filters.projectId ||
      filters.tagIds.length ||
      filters.startedAfter ||
      filters.startedBefore,
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800 rtl:pl-3 rtl:pr-9"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              aria-label={isExpanded ? (labels?.hideFilters || "Hide filters") : (labels?.showFilters || "Filters")}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm transition-colors ${
                isExpanded || hasActiveFilters
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -right-1 -top-1 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white dark:bg-sky-500">
                  {activeChips.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                setDraftFilters({
                  projectId: "",
                  clientId: "",
                  tagIds: [],
                  startedAfter: "",
                  startedBefore: "",
                });
                onClearFilters();
              }}
              disabled={!hasActiveFilters}
              aria-label={labels?.clear || "Clear"}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm transition ${
                hasActiveFilters
                  ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                  : "border-slate-200 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <X className="h-4 w-4" />
            </button>

          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-200 pt-2 dark:border-slate-700">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
              <MiniFilterBlock icon={<CalendarRange className="h-3.5 w-3.5" />} label={labels?.customFrom || "From date"}>
                <JalaliDatePicker
                  value={draftFilters.startedAfter}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, startedAfter: value }))}
                  placeholder="YYYY/MM/DD"
                  inputClassName="h-8 border border-slate-200 bg-white px-2 text-sm shadow-none focus:ring-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </MiniFilterBlock>

              <MiniFilterBlock icon={<CalendarRange className="h-3.5 w-3.5" />} label={labels?.customTo || "To date"}>
                <JalaliDatePicker
                  value={draftFilters.startedBefore}
                  onChange={(value) => setDraftFilters((current) => ({ ...current, startedBefore: value }))}
                  placeholder="YYYY/MM/DD"
                  inputClassName="h-8 border border-slate-200 bg-white px-2 text-sm shadow-none focus:ring-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </MiniFilterBlock>

              <MiniFilterBlock icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} label={labels?.client || "Client"}>
                <Select
                  value={draftFilters.clientId}
                  onChange={(clientId) =>
                    setDraftFilters((current) => ({
                      ...current,
                      clientId,
                      projectId:
                        current.projectId &&
                        !projects.some(
                          (project) =>
                            normalizeOptionId(project.id) === normalizeOptionId(current.projectId) &&
                            normalizeOptionId(project.client?.id) === normalizeOptionId(clientId),
                        )
                          ? ""
                          : current.projectId,
                    }))
                  }
                  options={[{ value: "", label: labels?.allClients || "All clients" }, ...clients]}
                  className="w-full"
                  buttonClassName="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-none focus:ring-0 dark:border-slate-700 dark:bg-slate-900"
                />
              </MiniFilterBlock>

              <MiniFilterBlock icon={<FolderKanban className="h-3.5 w-3.5" />} label={labels?.project || "Project"}>
                <Select
                  value={draftFilters.projectId}
                  onChange={(projectId) => setDraftFilters((current) => ({ ...current, projectId }))}
                  options={[{ value: "", label: labels?.allProjects || "All projects" }, ...(
                    draftFilters.clientId
                      ? projects.filter((project) => normalizeOptionId(project.client?.id) === normalizeOptionId(draftFilters.clientId))
                      : projects
                  ).map((project) => ({ value: normalizeOptionId(project.id), label: project.name }))]}
                  className="w-full"
                  buttonClassName="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm shadow-none focus:ring-0 dark:border-slate-700 dark:bg-slate-900"
                />
              </MiniFilterBlock>

              <MiniFilterBlock icon={<TagIcon className="h-3.5 w-3.5" />} label={labels?.tags || "Tags"}>
                <FilterTagMultiSelect
                  tags={tags}
                  selectedTagIds={draftFilters.tagIds}
                  onChange={(tagIds) => setDraftFilters((current) => ({ ...current, tagIds }))}
                  title={labels?.allTags || "All tags"}
                  searchPlaceholder={labels?.searchTags || "Search tags..."}
                  emptyLabel={labels?.noTagsFound || "No tags found."}
                />
              </MiniFilterBlock>
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onApply(draftFilters)}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-sky-50 border-sky-200 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300 px-3 text-sm font-medium transition hover:border-sky-700 hover:bg-sky-700 hover:text-sky-100 dark:hover:border-sky-400 dark:hover:text-sky-900 dark:hover:bg-sky-400"
              >
                {labels?.apply || "Apply"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
