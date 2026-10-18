import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Check, ChevronDown, Clock3, DollarSign, MoreVertical, Pencil, Play, Plus, Search, Square, Tag as TagIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getProjects, type Project } from "../api/projects";
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntries,
  stopTimeEntry,
  type TimeEntryGroupWeek,
  type TimeEntry,
  type TimeEntryListParams,
  type TimeEntryPayload,
  updateTimeEntry,
} from "../api/timeEntries";
import { getTags, type Tag } from "../api/tags";
import { Modal } from "../components/Modal";
import EmptyStateCard from "../components/EmptyStateCard";
import { InfiniteScroll } from "../components/InfiniteScroll";
import TimesheetFilterBar, { type TimeEntryFilters } from "../components/timesheet/TimesheetFilterBar";
import JalaliDatePicker from "../components/ui/JalaliDatePicker";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import { stageEnabled } from "../config/stages";
import { useWorkspace } from "../context/WorkspaceContext";
import { useTranslation } from "../hooks/useTranslation";
import {
  readArrayParam,
  readStringParam,
  updateQueryParams,
} from "../lib/queryParams";

type EntryModalMode = "manual" | "edit" | null;

interface EntryFormState {
  description: string;
  projectId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isBillable: boolean;
  tags: string[];
}

interface TimerDraftState {
  description: string;
  projectId: string;
  isBillable: boolean;
  tags: string[];
}

interface TimerClockAnchor {
  serverNowMs: number;
  performanceNowMs: number;
}

const EMPTY_FORM: EntryFormState = {
  description: "",
  projectId: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  isBillable: false,
  tags: [],
};

const EMPTY_TIMER_DRAFT: TimerDraftState = {
  description: "",
  projectId: "",
  isBillable: false,
  tags: [],
};

const DEFAULT_ENTRY_FILTERS: TimeEntryFilters = {
  projectId: "",
  clientId: "",
  tagIds: [],
  startedAfter: "",
  startedBefore: "",
};

const pad = (value: number) => String(value).padStart(2, "0");

const normalizeDigits = (value: string) => value.trim();

const parseApiDateTime = (value?: string | null) => {
  if (!value) return null;

  const normalized = normalizeDigits(String(value).trim());
  const candidates = Array.from(new Set([normalized, normalized.replace(" ", "T")]));

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds || 0),
    0,
  );
};

const formatTimeInputValue = (value: string) => {
  const digits = normalizeDigits(value).replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
};

const getTimeCursorPosition = (digitCount: number) => {
  if (digitCount <= 2) return digitCount;
  if (digitCount <= 4) return digitCount + 1;
  return Math.min(digitCount + 2, 8);
};

const handleFormattedTimeInputChange = (
  event: React.ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
) => {
  const input = event.target;
  const selectionStart = input.selectionStart ?? input.value.length;
  const digitsBeforeCursor = normalizeDigits(input.value.slice(0, selectionStart)).replace(/\D/g, "").slice(0, 6);
  const formattedValue = formatTimeInputValue(input.value);
  const nextCursor = getTimeCursorPosition(digitsBeforeCursor.length);

  onChange(formattedValue);

  window.requestAnimationFrame(() => {
    if (document.activeElement !== input) return;
    input.setSelectionRange(nextCursor, nextCursor);
  });
};

const isValidTimeValue = (value: string) => {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
};

const getLocalDateParts = (value?: string | null) => {
  const parsed = parseApiDateTime(value);
  if (!parsed) {
    return {
      date: "",
      time: "",
    };
  }

  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`,
  };
};

const combineDateAndTime = (dateValue: string, timeValue: string) => {
  if (!dateValue || !isValidTimeValue(timeValue)) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes, seconds] = timeValue.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds, 0).toISOString();
};

const formatDateTime = (value: string, locale: "en" | "fa") => {
  const parsed = parseApiDateTime(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(parsed);
};

const formatDateOnly = (value: string, locale: "en" | "fa") => {
  const parsed = parseApiDateTime(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    dateStyle: "medium",
  }).format(parsed);
};

const resolveEntryStartMs = (entry: TimeEntry) => entry.start_time_ms ?? parseApiDateTime(entry.start_time)?.getTime();

const resolveEntryEndMs = (entry: TimeEntry, now = Date.now()) =>
  entry.end_time_ms ?? (entry.end_time ? parseApiDateTime(entry.end_time)?.getTime() : now);

const formatDuration = (entry: TimeEntry, now = Date.now()) => {
  const start = resolveEntryStartMs(entry);
  const end = resolveEntryEndMs(entry, now);

  if (!start || !end) return "00:00:00";

  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

const getEntryDurationMs = (entry: TimeEntry, now = Date.now()) => {
  const start = resolveEntryStartMs(entry);
  const end = resolveEntryEndMs(entry, now);
  if (!start || !end) return 0;
  return Math.max(0, end - start);
};

const getAnchoredServerNowMs = (anchor: TimerClockAnchor | null, performanceNow: number) =>
  anchor ? anchor.serverNowMs + Math.max(0, performanceNow - anchor.performanceNowMs) : Date.now();

const formatDurationMs = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

const formatTimeOnly = (value?: string | null, locale: "en" | "fa" = "en") => {
  const parsed = parseApiDateTime(value);
  if (!parsed) return "--:--:--";

  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

const getWeekStart = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - value.getDay());
  return value;
};

const formatWeekRange = (date: Date, locale: "en" | "fa") => {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

const formatDayLabel = (date: Date, locale: "en" | "fa") =>
  new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

const mergeGroupedHistory = (currentGroups: TimeEntryGroupWeek[], nextGroups: TimeEntryGroupWeek[]) => {
  const merged = currentGroups.map((week) => ({
    ...week,
    days: week.days.map((day) => ({ ...day, entries: [...day.entries] })),
  }));

  nextGroups.forEach((incomingWeek) => {
    const existingWeek = merged.find((week) => week.key === incomingWeek.key);
    if (!existingWeek) {
      merged.push({
        ...incomingWeek,
        days: incomingWeek.days.map((day) => ({ ...day, entries: [...day.entries] })),
      });
      return;
    }

    existingWeek.total_ms = incomingWeek.total_ms;

    incomingWeek.days.forEach((incomingDay) => {
      const existingDay = existingWeek.days.find((day) => day.key === incomingDay.key);
      if (!existingDay) {
        existingWeek.days.push({ ...incomingDay, entries: [...incomingDay.entries] });
        return;
      }

      existingDay.total_ms = incomingDay.total_ms;
      const existingIds = new Set(existingDay.entries.map((entry) => entry.id));
      incomingDay.entries.forEach((entry) => {
        if (!existingIds.has(entry.id)) {
          existingDay.entries.push(entry);
        }
      });
    });
  });

  return merged;
};

const updateGroupedHistoryEntry = (
  groups: TimeEntryGroupWeek[],
  updatedEntry: TimeEntry,
) => {
  const filteredGroups = groups
    .map((week) => ({
      ...week,
      days: week.days
        .map((day) => ({
          ...day,
          entries: day.entries.filter((entry) => entry.id !== updatedEntry.id),
        }))
        .filter((day) => day.entries.length > 0),
    }))
    .filter((week) => week.days.length > 0);

  if (!updatedEntry.end_time) {
    return filteredGroups;
  }

  const start = parseApiDateTime(updatedEntry.start_time);
  if (!start) {
    return filteredGroups;
  }

  // Keep local regrouping aligned with backend grouped format (one day per group).
  const dayKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const weekKey = dayKey;
  const merged = filteredGroups.map((week) => ({
    ...week,
    days: week.days.map((day) => ({ ...day, entries: [...day.entries] })),
  }));

  let targetWeek = merged.find((week) => week.key === weekKey);
  if (!targetWeek) {
    targetWeek = {
      key: weekKey,
      week_start: dayKey,
      week_end: dayKey,
      total_ms: 0,
      days: [],
    };
    merged.push(targetWeek);
  }

  let targetDay = targetWeek.days.find((day) => day.key === dayKey);
  if (!targetDay) {
    targetDay = {
      key: dayKey,
      date: dayKey,
      total_ms: 0,
      entries: [],
    };
    targetWeek.days.push(targetDay);
  }

  targetDay.entries.unshift(updatedEntry);
  targetDay.entries.sort((a, b) => {
    const aTime = parseApiDateTime(a.start_time)?.getTime() || 0;
    const bTime = parseApiDateTime(b.start_time)?.getTime() || 0;
    return bTime - aTime;
  });
  targetDay.total_ms = targetDay.entries.reduce((sum, entry) => sum + getEntryDurationMs(entry), 0);
  targetWeek.total_ms = targetWeek.days.reduce((sum, day) => sum + day.total_ms, 0);

  merged.sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
  merged.forEach((week) => {
    week.days.sort((a, b) => (a.date < b.date ? 1 : -1));
  });

  return merged;
};

const buildEntryFormState = (entry?: TimeEntry | null): EntryFormState => {
  if (!entry) {
    const now = getLocalDateParts(new Date().toISOString());
    return {
      ...EMPTY_FORM,
      startDate: now.date,
      startTime: now.time,
    };
  }

  const start = getLocalDateParts(entry.start_time);
  const end = getLocalDateParts(entry.end_time);

  return {
    description: entry.description || "",
    projectId: entry.project || "",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    isBillable: entry.is_billable,
    tags: entry.tags || [],
  };
};

const buildTimerDraftState = (entry?: TimeEntry | null): TimerDraftState => ({
  description: entry?.description || "",
  projectId: entry?.project || "",
  isBillable: entry?.is_billable || false,
  tags: entry?.tags || [],
});

const serializeTimerDraft = (state: TimerDraftState) =>
  JSON.stringify({
    description: state.description.trim(),
    projectId: state.projectId || "",
    isBillable: state.isBillable,
    tags: [...state.tags].sort(),
  });

const serializeEntryDraft = (state: EntryFormState) =>
  JSON.stringify({
    description: state.description.trim(),
    projectId: state.projectId || "",
    startDate: state.startDate || "",
    startTime: state.startTime || "",
    endDate: state.endDate || "",
    endTime: state.endTime || "",
    isBillable: state.isBillable,
    tags: [...state.tags].sort(),
  });

const toggleTagId = (currentTags: string[], tagId: string) =>
  currentTags.includes(tagId) ? currentTags.filter((currentId) => currentId !== tagId) : [...currentTags, tagId];

const buildPayloadFromState = (
  state: EntryFormState,
  options: { includeWorkspace: boolean; workspaceId?: string },
): { payload?: TimeEntryPayload; error?: string } => {
  const startDateTime = combineDateAndTime(state.startDate, state.startTime);
  if (!startDateTime) {
    return { error: "Start date and time are required." };
  }

  let endDateTime: string | null = null;
  const hasEndValue = Boolean(state.endDate || state.endTime);
  if (hasEndValue) {
    if (!state.endDate || !state.endTime) {
      return { error: "End date and time must both be filled." };
    }

    endDateTime = combineDateAndTime(state.endDate, state.endTime);
    if (!endDateTime) {
      return { error: "End time is invalid." };
    }
  }

  const payload: TimeEntryPayload = {
    description: state.description.trim(),
    project_id: state.projectId || null,
    start_time: startDateTime,
    end_time: endDateTime,
    tags: state.tags,
    is_billable: state.isBillable,
  };

  if (options.includeWorkspace && options.workspaceId) {
    payload.workspace_id = options.workspaceId;
  }

  return { payload };
};

const buildDeletedProjectLabel = (projectName: string, deletedLabel: string) => `${deletedLabel}: ${projectName}`;
const buildDeletedTagLabel = (tagName: string, deletedLabel: string) => `${deletedLabel}: ${tagName}`;

const getEntryProjectOption = (entry?: TimeEntry | null, deletedProjectLabel?: string): Project | null => {
  if (!entry?.project_details) return null;

  return {
    id: entry.project_details.id,
    name: entry.project_details.is_deleted
      ? buildDeletedProjectLabel(entry.project_details.name, deletedProjectLabel || "Deleted project")
      : entry.project_details.name,
    description: "",
    color: "",
    is_archived: false,
    is_deleted: entry.project_details.is_deleted,
    workspace: entry.workspace,
    client: entry.project_details.client_name
      ? { id: "", name: entry.project_details.client_name }
      : null,
  };
};

const buildProjectOptionsForEntry = (
  activeProjects: Project[],
  entry: TimeEntry | null | undefined,
  selectedProjectId: string,
  deletedProjectLabel?: string,
) => {
  const projectsById = new Map(activeProjects.map((project) => [project.id, project]));
  const currentProject = getEntryProjectOption(entry, deletedProjectLabel);

  if (
    currentProject &&
    currentProject.id === selectedProjectId &&
    !projectsById.has(currentProject.id)
  ) {
    projectsById.set(currentProject.id, currentProject);
  }

  return Array.from(projectsById.values());
};

const buildTagOptionsForEntry = (
  activeTags: Tag[],
  entry: TimeEntry | null | undefined,
  selectedTagIds: string[],
) => {
  const tagsById = new Map(activeTags.map((tag) => [tag.id, tag]));
  const entryWorkspaceId = entry?.workspace || "";
  const entryCreatedAt = entry?.created_at || "";
  const entryUpdatedAt = entry?.updated_at || "";

  (entry?.tag_details || []).forEach((tag) => {
    if (!selectedTagIds.includes(tag.id) || tagsById.has(tag.id)) return;

    tagsById.set(tag.id, {
      id: tag.id,
      workspace: entryWorkspaceId,
      name: tag.name,
      color: tag.color,
      is_deleted: tag.is_deleted,
      created_at: entryCreatedAt,
      updated_at: entryUpdatedAt,
    });
  });

  return Array.from(tagsById.values());
};

const getProjectDisplayDetails = (entry: TimeEntry, activeProjects: Project[]) => {
  const activeProject = activeProjects.find((item) => item.id === entry.project);
  if (activeProject) {
    return {
      name: activeProject.name,
      clientName: activeProject.client?.name || null,
      isDeleted: Boolean(activeProject.is_deleted),
    };
  }

  if (!entry.project_details) {
    return null;
  }

  return {
    name: entry.project_details.name,
    clientName: entry.project_details.client_name,
    isDeleted: entry.project_details.is_deleted,
  };
};

const getTagDisplayDetails = (entry: TimeEntry, activeTags: Tag[]) => {
  const activeTagsById = new Map(activeTags.map((tag) => [tag.id, tag]));

  return entry.tags.map((tagId) => {
    const activeTag = activeTagsById.get(tagId);
    if (activeTag) {
      return {
        id: activeTag.id,
        name: activeTag.name,
        color: activeTag.color,
        isDeleted: Boolean(activeTag.is_deleted),
      };
    }

    const deletedTag = entry.tag_details.find((tag) => tag.id === tagId);
    if (!deletedTag) {
      return null;
    }

    return {
      id: deletedTag.id,
      name: deletedTag.name,
      color: deletedTag.color,
      isDeleted: deletedTag.is_deleted,
    };
  }).filter(Boolean) as Array<{ id: string; name: string; color: string; isDeleted: boolean }>;
};

function TimeField({
  label,
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "min-w-[104px]" : ""}>
      <label className={`block text-sm font-medium text-slate-700 dark:text-slate-300 ${compact ? "mb-0.5 text-[11px]" : "mb-1"}`}>{label}</label>
      <Input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={value}
        maxLength={8}
        placeholder={placeholder || "HH:MM:SS"}
        className={compact ? "h-9 px-2 text-xs" : ""}
        onChange={(event) => handleFormattedTimeInputChange(event, onChange)}
      />
    </div>
  );
}

function BillableIconButton({
  checked,
  onChange,
  label,
  disabled = false,
  compact = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center justify-center transition-colors ${
        checked
          ? "text-sky-600 dark:text-sky-400"
          : "text-slate-400 dark:text-slate-500"
      } ${compact ? "h-12 w-10 border-s border-slate-200 bg-transparent hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/70" : "gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <DollarSign className="h-4 w-4" />
      {!compact && <span className="font-medium">{label}</span>}
    </button>
  );
}

function TagMultiSelect({
  tags,
  selectedTags,
  onToggleTag,
  emptyHint,
  title,
  compact = false,
  portalOwnerId,
  className = "",
  buttonClassName = "",
  compactDisplayMode = "summary",
}: {
  tags: Tag[];
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
  emptyHint: string;
  title: string;
  compact?: boolean;
  portalOwnerId?: string;
  className?: string;
  buttonClassName?: string;
  compactDisplayMode?: "summary" | "chips";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = wrapperRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = compact ? 256 : Math.max(rect.width, 256);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 280 && rect.top > spaceBelow;

    setDropdownStyle({
      position: "fixed",
      top: openUpward ? `${rect.top - 8}px` : `${rect.bottom + 8}px`,
      left: `${Math.max(12, rect.right - dropdownWidth)}px`,
      width: `${dropdownWidth}px`,
      transform: openUpward ? "translateY(-100%)" : "none",
      zIndex: 100000,
    });
  }, [compact, isOpen]);

  useEffect(() => {
    const closeOnViewportChange = () => setIsOpen(false);

    if (isOpen) {
      window.addEventListener("resize", closeOnViewportChange);
    }

    return () => {
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const selectedTagObjects = tags.filter((tag) => selectedTags.includes(tag.id));
  const selectedLabels = selectedTagObjects.map((tag) => tag.name);
  const joinedSelectedLabels = selectedLabels.join(" | ");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTags = normalizedSearch
    ? tags.filter((tag) => tag.name.toLowerCase().includes(normalizedSearch))
    : tags;
  const buttonLabel = compact
    ? selectedTags.length > 0
      ? joinedSelectedLabels
      : ""
    : selectedLabels.length > 0
      ? selectedLabels.join(", ")
      : title;

  return (
    <div ref={wrapperRef} className={`${compact ? "relative min-w-0" : "relative"} ${className}`.trim()}>
      {!compact && <p className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        title={selectedLabels.length > 0 ? selectedLabels.join(", ") : title}
        className={`inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 ${
          compact
            ? "h-12 max-w-full border-0 bg-transparent px-2 text-xs overflow-hidden"
            : "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        } ${buttonClassName}`.trim()}
      >
        {compact ? (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden">
            {selectedTagObjects.length > 0 && compactDisplayMode === "chips" ? (
              <span className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden whitespace-nowrap">
                {selectedTagObjects.map((tag, index) => (
                  <span
                    key={tag.id}
                    title={tag.name}
                    className={`shrink rounded-sm px-2 py-1 text-[11px] font-medium ${
                      index === 0 ? "max-w-[96px]" : "max-w-[72px]"
                    } ${
                      tag.is_deleted
                        ? "bg-slate-200 text-slate-700 line-through dark:bg-slate-700 dark:text-slate-200"
                        : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                    }`}
                  >
                    {tag.name}
                  </span>
                ))}
              </span>
            ) : buttonLabel ? (
              <span className="truncate rounded-sm bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                {buttonLabel}
              </span>
            ) : (
              <TagIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            )}
          </span>
        ) : (
          <span className="truncate">{buttonLabel}</span>
        )}
        {!compact && <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
      </button>

      {isOpen && (
        createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          data-entry-editor-owner={portalOwnerId}
          className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {tags.length === 0 ? (
            <p className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyHint}</p>
          ) : (
            <>
              <div className="border-b border-slate-200 p-2 dark:border-slate-700">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search tags..."
                    className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800"
                  />
                </div>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                {filteredTags.map((tag) => {
                  const selected = selectedTags.includes(tag.id);
                  const isUnavailable = Boolean(tag.is_deleted) && !selected;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (isUnavailable) return;
                        onToggleTag(tag.id);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm transition-colors ${
                        selected
                          ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white"
                          : isUnavailable
                            ? "cursor-not-allowed text-slate-400 opacity-70 dark:text-slate-500"
                            : "text-slate-700 dark:text-slate-200"
                      }`}
                      title={tag.name}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2 truncate">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color || "#94A3B8" }} />
                        <span className={`truncate ${tag.is_deleted ? "line-through text-slate-700 dark:text-slate-300" : ""}`}>{tag.name}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
                {filteredTags.length === 0 && (
                  <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                    No tags found.
                  </div>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
        )
      )}
    </div>
  );
}

function ProjectInlineSelect({
  projects,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  portalOwnerId,
  className = "",
  dropdownClassName = "",
  disabled = false,
}: {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  portalOwnerId?: string;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [optionListMaxHeight, setOptionListMaxHeight] = useState(256);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = wrapperRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const viewportPadding = 12;
    const dropdownWidth = Math.max(240, Math.min(360, window.innerWidth - viewportPadding * 2));
    const searchAreaHeight = 58;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(160, openUpward ? spaceAbove - 8 : spaceBelow - 8);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - dropdownWidth - viewportPadding),
    );

    setOptionListMaxHeight(Math.max(120, availableHeight - searchAreaHeight));

    setDropdownStyle({
      position: "fixed",
      top: openUpward ? `${rect.top - 8}px` : `${rect.bottom + 8}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      maxHeight: `${availableHeight}px`,
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
      setQuery("");
    }
  }, [isOpen]);

  const selectedProject = projects.find((project) => project.id === value);
  const label = selectedProject?.name || placeholder;
  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => {
      const clientName = project.client?.name || "";
      return `${project.name} ${clientName}`.toLowerCase().includes(needle);
    });
  }, [projects, query]);

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen((current) => !current)}
        disabled={disabled}
        className={`inline-flex w-full max-w-full items-center rounded-sm bg-transparent py-0 text-sm transition-colors ${
          selectedProject
            ? "text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        } disabled:cursor-not-allowed disabled:opacity-60`}
        title={label}
      >
        <span className="truncate">{label}</span>
      </button>

      {isOpen && !disabled &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            data-entry-editor-owner={portalOwnerId}
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800 ${dropdownClassName}`}
          >
            <div className="border-b border-slate-200 p-2 dark:border-slate-700">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-800"
                />
              </div>
            </div>
            <div className="space-y-1 overflow-y-auto p-2" style={{ maxHeight: optionListMaxHeight }}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center rounded-xl px-3 py-2 text-sm transition-colors ${
                  value === ""
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70"
                }`}
              >
                {placeholder}
              </button>

              {filteredProjects.map((project) => {
                const selected = project.id === value;
                const unavailable = Boolean(project.is_deleted) && !selected;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (unavailable) return;
                      onChange(project.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                        : unavailable
                          ? "cursor-not-allowed text-slate-400 opacity-70 dark:text-slate-500"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70"
                    }`}
                    title={project.name}
                  >
                    <span className={`truncate ${project.is_deleted ? "italic" : ""}`}>{project.name}</span>
                  </button>
                );
              })}
              {filteredProjects.length === 0 && (
                <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function CompactDateTimeField({
  label,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  dateValue: string;
  timeValue: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div className="min-w-[208px]">
      <label className="mb-0.5 block text-[11px] font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex h-9 items-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <JalaliDatePicker
            value={dateValue}
            onChange={onDateChange}
            inputClassName="h-9 rounded-none border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <Input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={timeValue}
          maxLength={8}
          placeholder="HH:MM:SS"
          className="h-9 min-w-[88px] border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(event) => onTimeChange(formatTimeInputValue(event.target.value))}
        />
      </div>
    </div>
  );
}

function InlineTimeRangeField({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <div className="flex h-12 items-center justify-center border-s border-slate-200 px-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-200">
      <Input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={startTime}
        maxLength={8}
        placeholder="HH:MM:SS"
        className="h-9 min-w-[68px] border-0 bg-transparent dark:bg-transparent px-0 text-center text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onChange={(event) => handleFormattedTimeInputChange(event, onStartTimeChange)}
      />
      <span className="px-1 text-slate-400">-</span>
      <Input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={endTime}
        maxLength={8}
        placeholder="HH:MM:SS"
        className="h-9 min-w-[68px] border-0 bg-transparent dark:bg-transparent px-0 text-center text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onChange={(event) => handleFormattedTimeInputChange(event, onEndTimeChange)}
      />
    </div>
  );
}

function DateRangePopover({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  portalOwnerId,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  portalOwnerId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [calendarPosition, setCalendarPosition] = useState("bottom-right");

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = wrapperRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const viewportPadding = 12;
    const dropdownWidth = 280;
    const dropdownHeight = 248;
    const gap = 8;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceLeft = rect.left - viewportPadding;
    const spaceRight = window.innerWidth - rect.right - viewportPadding;
    const openSideways = spaceBelow < dropdownHeight;
    const openLeft = openSideways && spaceLeft >= dropdownWidth + gap;
    const openRight = openSideways && !openLeft && spaceRight >= dropdownWidth + gap;
    const top = openSideways
      ? Math.min(
          Math.max(viewportPadding, rect.top - dropdownHeight / 2 + rect.height / 2),
          Math.max(viewportPadding, window.innerHeight - dropdownHeight - viewportPadding),
        )
      : rect.bottom + gap;
    const left = openLeft
      ? rect.left - dropdownWidth - gap
      : openRight
        ? rect.right + gap
        : Math.min(
            Math.max(viewportPadding, rect.right - dropdownWidth),
            Math.max(viewportPadding, window.innerWidth - dropdownWidth - viewportPadding),
          );

    setCalendarPosition(openSideways ? (openLeft ? "left" : "right") : "bottom-right");

    setDropdownStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      zIndex: 100000,
    });
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-12 w-10 items-center justify-center border-s border-slate-200 bg-transparent text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
        title="Edit dates"
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            data-entry-editor-owner={portalOwnerId}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="grid gap-3">
              <JalaliDatePicker
                label="Start date"
                value={startDate}
                onChange={onStartDateChange}
                calendarPosition={calendarPosition}
              />
              <JalaliDatePicker
                label="End date"
                value={endDate}
                onChange={onEndDateChange}
                calendarPosition={calendarPosition}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function DeleteEntryButton({
  onDelete,
}: {
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      className="inline-flex h-12 w-10 items-center justify-center rounded-none border-0 bg-transparent text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function EntryEditorFields({
  state,
  onChange,
  onToggleTag,
  onProjectChange,
  projects,
  tags,
  t,
  isRtl,
  compact = false,
  portalOwnerId,
}: {
  state: EntryFormState;
  onChange: (patch: Partial<EntryFormState>) => void;
  onToggleTag: (tagId: string) => void;
  onProjectChange?: (projectId: string) => void;
  projects: Project[];
  tags: Tag[];
  t: any;
  isRtl: boolean;
  compact?: boolean;
  portalOwnerId?: string;
}) {
  if (compact) {
    const selectedProject = projects.find((project) => project.id === state.projectId);
    return (
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(430px,1fr)_minmax(0,220px)_40px_188px_40px] 2xl:grid-cols-[minmax(430px,1fr)_minmax(0,max-content)_40px_188px_40px] items-center">
        <div className="flex min-w-0 items-center">
          <Input
            value={state.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder={t.timesheet?.descriptionPlaceholder || "What are you working on?"}
            className="h-12 w-[200px] 2xl:w-[400px] shrink-0 rounded-none border-0 bg-transparent px-0 pe-3 text-sm shadow-none placeholder:text-slate-300 focus-visible:ring-0 focus-visible:ring-offset-0 truncate dark:bg-transparent dark:text-slate-100 dark:placeholder:text-slate-600"
          />

          <span className="me-2 shrink-0 text-sm font-semibold leading-none text-sky-600 dark:text-sky-400">•</span>

          <div className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <ProjectInlineSelect
                projects={projects}
                value={state.projectId}
                onChange={(projectId) => (onProjectChange ? onProjectChange(projectId) : onChange({ projectId }))}
                placeholder={t.timesheet?.projectLabel || "Project"}
                searchPlaceholder={t.timesheet?.searchProjectsLabel || t.projects?.searchPlaceholder || "Search projects..."}
                emptyLabel={t.timesheet?.noProjectsFoundLabel || "No projects found."}
                portalOwnerId={portalOwnerId}
                className="min-w-0 max-w-fit flex-1"
              />

              {selectedProject?.client?.name && (
                <span className="min-w-0 max-w-[120px] 2xl:max-w-fit shrink truncate text-sm text-slate-400 dark:text-slate-500" title={selectedProject.client.name}>
                  - {selectedProject.client.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden pe-2" dir="ltr">
          <TagMultiSelect
            tags={tags}
            selectedTags={state.tags}
            onToggleTag={onToggleTag}
            emptyHint={t.timesheet?.noTagsHint || "Create tags first from the Tags page."}
            title={t.tags?.title || "Tags"}
            compact
            compactDisplayMode="chips"
            portalOwnerId={portalOwnerId}
            className="w-full min-w-0 overflow-hidden 2xl:w-auto 2xl:max-w-none"
            buttonClassName="w-full min-w-0 max-w-full justify-start overflow-hidden 2xl:w-auto 2xl:max-w-none"
          />
        </div>

        <div className="w-10">
          <BillableIconButton
            checked={state.isBillable}
            onChange={(checked) => onChange({ isBillable: checked })}
            label={t.timesheet?.billable || "Billable"}
            compact
          />
        </div>

        <div>
          <InlineTimeRangeField
            startTime={state.startTime}
            endTime={state.endTime}
            onStartTimeChange={(value) => onChange({ startTime: value })}
            onEndTimeChange={(value) => onChange({ endTime: value })}
          />
        </div>

        <div>
          <DateRangePopover
            startDate={state.startDate}
            endDate={state.endDate}
            onStartDateChange={(value) => onChange({ startDate: value })}
            onEndDateChange={(value) => onChange({ endDate: value })}
            portalOwnerId={portalOwnerId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={`block font-medium text-slate-700 dark:text-slate-300 ${compact ? "mb-0.5 text-[11px]" : "mb-1 text-sm"}`}>
          {t.timesheet?.descriptionLabel || "Description"}
        </label>
        <Input
          value={state.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder={t.timesheet?.descriptionPlaceholder || "What are you working on?"}
          className={compact ? "h-9 px-2 text-xs placeholder:text-slate-300 dark:placeholder:text-slate-600" : "placeholder:text-slate-300 dark:placeholder:text-slate-600"}
        />
      </div>

      <div>
        <label className={`block font-medium text-slate-700 dark:text-slate-300 ${compact ? "mb-0.5 text-[11px]" : "mb-1 text-sm"}`}>
          {t.timesheet?.projectLabel || "Project"}
        </label>
        <SearchableSelect
          value={state.projectId}
          onChange={(value) => onChange({ projectId: String(value) })}
          options={[
            { value: "", label: t.timesheet?.noProject || "No project" },
            ...projects.map((project) => ({
              value: project.id,
              label: project.name,
              searchText: project.client?.name || "",
            })),
          ]}
          placeholder={t.timesheet?.noProject || "No project"}
          searchPlaceholder={t.timesheet?.searchProjectsLabel || t.projects?.searchPlaceholder || "Search projects..."}
          emptyLabel={t.timesheet?.noProjectsFoundLabel || "No projects found."}
          className="w-full"
          buttonClassName={compact ? "w-full h-9 px-2 text-xs" : "w-full"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={compact ? "" : "space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"}>
          <JalaliDatePicker
            label={t.timesheet?.startLabel || "Start"}
            value={state.startDate}
            onChange={(date) => onChange({ startDate: date })}
            inputClassName={compact ? "h-9 px-2 text-xs" : undefined}
          />
          <TimeField
            label={t.timesheet?.timeLabel || "Time"}
            value={state.startTime}
            onChange={(value) => onChange({ startTime: value })}
            compact={compact}
          />
        </div>

        <div className={compact ? "" : "space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"}>
          <JalaliDatePicker
            label={t.timesheet?.endLabel || "End"}
            value={state.endDate}
            onChange={(date) => onChange({ endDate: date })}
            inputClassName={compact ? "h-9 px-2 text-xs" : undefined}
          />
          <TimeField
            label={t.timesheet?.timeLabel || "Time"}
            value={state.endTime}
            onChange={(value) => onChange({ endTime: value })}
            compact={compact}
          />
        </div>
      </div>

      <div>
        <BillableIconButton
          checked={state.isBillable}
          onChange={(checked) => onChange({ isBillable: checked })}
          label={t.timesheet?.billable || "Billable"}
        />
      </div>

      <TagMultiSelect
        tags={tags}
        selectedTags={state.tags}
        onToggleTag={onToggleTag}
        emptyHint={t.timesheet?.noTagsHint || "Create tags first from the Tags page."}
        title={t.tags?.title || "Tags"}
        compact={compact}
      />
    </div>
  );
}

function RecordedEntryCard({
  entry,
  t,
  projects,
  tags,
  onDelete,
  onRestart,
  onEntryUpdated,
  variant = "desktop",
  lang,
}: {
  entry: TimeEntry;
  t: any;
  projects: Project[];
  tags: Tag[];
  onDelete: (entry: TimeEntry) => void;
  onRestart: (entry: TimeEntry) => void;
  onEntryUpdated: (entry: TimeEntry) => void;
  variant?: "desktop" | "tablet";
  lang: "en" | "fa";
}) {
  const [draft, setDraft] = useState<EntryFormState>(() => buildEntryFormState(entry));
  const [validationMessage, setValidationMessage] = useState("");
  const syncedSignatureRef = useRef(serializeEntryDraft(buildEntryFormState(entry)));
  const rowRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);
  const pendingSignatureRef = useRef<string | null>(null);
  const editorOwnerId = `time-entry-editor-${entry.id}`;
  const timesheetCopy = (t.timesheet as { saveError?: string; saveSuccess?: string }) || {};
  const saveErrorText = timesheetCopy.saveError || "Failed to save time entry";
  const saveSuccessText = timesheetCopy.saveSuccess || "Time entry saved";
  const deletedProjectLabel = t.timesheet?.deletedProjectLabel || "Deleted project";
  const deletedTagLabel = t.timesheet?.deletedTagLabel || "Deleted tag";
  const editorProjects = useMemo(
    () => buildProjectOptionsForEntry(projects, entry, draft.projectId, deletedProjectLabel),
    [deletedProjectLabel, draft.projectId, entry, projects],
  );
  const editorTags = useMemo(
    () => buildTagOptionsForEntry(tags, entry, draft.tags),
    [draft.tags, entry, tags],
  );

  useEffect(() => {
    const nextDraft = buildEntryFormState(entry);
    const nextSignature = serializeEntryDraft(nextDraft);
    syncedSignatureRef.current = nextSignature;
    pendingSignatureRef.current = nextSignature;
    setDraft(nextDraft);
    setValidationMessage("");
  }, [entry]);

  const isInsideEditorContext = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    if (rowRef.current?.contains(target)) return true;
    return target instanceof Element && Boolean(target.closest(`[data-entry-editor-owner="${editorOwnerId}"]`));
  }, [editorOwnerId]);

  const commitDraft = useCallback(async () => {
    const currentSignature = serializeEntryDraft(draft);
    if (currentSignature === syncedSignatureRef.current) {
      setValidationMessage("");
      return false;
    }

    if (isSavingRef.current || pendingSignatureRef.current === currentSignature) {
      return false;
    }

    const { payload, error } = buildPayloadFromState(draft, { includeWorkspace: false });
    if (!payload) {
      setValidationMessage(error || "");
      return false;
    }

    setValidationMessage("");
    isSavingRef.current = true;
    pendingSignatureRef.current = currentSignature;
    try {
      const updatedEntry = await updateTimeEntry(entry.id, payload);
      const updatedDraft = buildEntryFormState(updatedEntry);
      const updatedSignature = serializeEntryDraft(updatedDraft);
      syncedSignatureRef.current = updatedSignature;
      pendingSignatureRef.current = updatedSignature;
      setDraft(updatedDraft);
      onEntryUpdated(updatedEntry);
      toast.success(saveSuccessText);
      return true;
    } catch (error) {
      console.error(error);
      pendingSignatureRef.current = null;
      toast.error(saveErrorText);
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [draft, entry.id, onEntryUpdated, saveErrorText, saveSuccessText]);

  const commitPatchedDraft = useCallback(async (patch: Partial<EntryFormState>) => {
    const nextDraft = { ...draft, ...patch };
    const nextSignature = serializeEntryDraft(nextDraft);
    setDraft(nextDraft);

    if (nextSignature === syncedSignatureRef.current) {
      setValidationMessage("");
      return false;
    }

    if (isSavingRef.current || pendingSignatureRef.current === nextSignature) {
      return false;
    }

    const { payload, error } = buildPayloadFromState(nextDraft, { includeWorkspace: false });
    if (!payload) {
      setValidationMessage(error || "");
      return false;
    }

    setValidationMessage("");
    isSavingRef.current = true;
    pendingSignatureRef.current = nextSignature;

    try {
      const updatedEntry = await updateTimeEntry(entry.id, payload);
      const updatedDraft = buildEntryFormState(updatedEntry);
      const updatedSignature = serializeEntryDraft(updatedDraft);
      syncedSignatureRef.current = updatedSignature;
      pendingSignatureRef.current = updatedSignature;
      setDraft(updatedDraft);
      onEntryUpdated(updatedEntry);
      toast.success(saveSuccessText);
      return true;
    } catch (error) {
      console.error(error);
      pendingSignatureRef.current = null;
      toast.error(saveErrorText);
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [draft, entry.id, onEntryUpdated, saveErrorText, saveSuccessText]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (isInsideEditorContext(event.target)) return;
      void commitDraft();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [commitDraft, isInsideEditorContext]);

  const handleBlurCapture = () => {
    window.setTimeout(() => {
      if (isInsideEditorContext(document.activeElement)) return;
      void commitDraft();
    }, 0);
  };

  if (variant === "tablet") {
    return (
      <div
        ref={rowRef}
        onBlurCapture={handleBlurCapture}
        className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900/95"
      >
        <div className="space-y-4">
          <EntryEditorFields
            state={draft}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onToggleTag={(tagId) => setDraft((current) => ({ ...current, tags: toggleTagId(current.tags, tagId) }))}
            onProjectChange={(projectId) => void commitPatchedDraft({ projectId })}
            projects={editorProjects}
            tags={editorTags}
            t={t}
            isRtl={false}
            portalOwnerId={editorOwnerId}
          />

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {formatDateTime(entry.start_time, lang)}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{formatDuration(entry)}</div>
              <button
                type="button"
                onClick={() => onRestart(entry)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Start from this entry"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
                title={t.actions?.delete || "Delete"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {validationMessage && (
          <div className="px-1 pb-1 pt-2">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{validationMessage}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rowRef} onBlurCapture={handleBlurCapture} className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex min-w-0 items-center">
        <EntryEditorFields
          state={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onToggleTag={(tagId) => setDraft((current) => ({ ...current, tags: toggleTagId(current.tags, tagId) }))}
          onProjectChange={(projectId) => void commitPatchedDraft({ projectId })}
          projects={editorProjects}
          tags={editorTags}
          t={t}
          isRtl={false}
          compact
          portalOwnerId={editorOwnerId}
        />

        <div className="flex h-12 shrink-0 items-center border-s border-slate-200 px-5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          {formatDuration(entry)}
        </div>

        <button
          type="button"
          onClick={() => onRestart(entry)}
          className="inline-flex h-12 w-10 shrink-0 items-center justify-center border-s border-slate-200 bg-transparent text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
          title="Start from this entry"
        >
          <Play className="h-4 w-4" />
        </button>

        <div className="border-s border-slate-200 dark:border-slate-700">
          <DeleteEntryButton onDelete={() => onDelete(entry)} />
        </div>
      </div>

      {validationMessage && (
        <div className="px-1 pb-3 pt-2">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{validationMessage}</p>
        </div>
      )}
    </div>
  );
}

function MobileRecordedEntryCard({
  entry,
  t,
  projects,
  tags,
  onEdit,
  onDelete,
  onRequestRestart,
  lang,
}: {
  entry: TimeEntry;
  t: any;
  projects: Project[];
  tags: Tag[];
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
  onRequestRestart: (entry: TimeEntry) => void;
  lang: "en" | "fa";
}) {
  const deletedProjectLabel = t.timesheet?.deletedProjectLabel || "Deleted project";
  const deletedTagLabel = t.timesheet?.deletedTagLabel || "Deleted tag";
  const project = getProjectDisplayDetails(entry, projects);
  const entryTags = getTagDisplayDetails(entry, tags);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        wrapperRef.current?.contains(event.target as Node) ||
        dropdownRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 168;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 180 && rect.top > spaceBelow;

    setMenuStyle({
      position: "fixed",
      top: openUpward ? `${rect.top - 8}px` : `${rect.bottom + 8}px`,
      left: `${Math.max(12, rect.right - dropdownWidth)}px`,
      width: `${dropdownWidth}px`,
      transform: openUpward ? "translateY(-100%)" : "none",
      zIndex: 100000,
    });
  }, [menuOpen]);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);

    if (menuOpen) {
      window.addEventListener("resize", closeMenu);
      window.addEventListener("scroll", closeMenu, true);
    }

    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuOpen]);

  const closeSwipe = () => {
    touchStartXRef.current = null;
    setSwipeOffset(0);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (menuOpen) {
      setMenuOpen(false);
    }
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const delta = (event.touches[0]?.clientX ?? 0) - touchStartXRef.current;
    setSwipeOffset(Math.max(-88, Math.min(88, delta)));
  };

  const handleTouchEnd = () => {
    if (swipeOffset <= -72) {
      closeSwipe();
      onDelete(entry);
      return;
    }

    if (swipeOffset >= 72) {
      closeSwipe();
      onRequestRestart(entry);
      return;
    }

    closeSwipe();
  };

  return (
    <div ref={wrapperRef} className="relative overflow-hidden border-b border-slate-200 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/70 xl:hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-24 items-center justify-start bg-emerald-500/12 ps-4 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Play className="h-4 w-4" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-end bg-red-500/12 pe-4 text-red-700 dark:bg-red-500/10 dark:text-red-300">
        <Trash2 className="h-4 w-4" />
      </div>

      <div
        className="relative bg-white px-4 py-5 transition-transform duration-150 ease-out dark:bg-slate-900/95"
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={closeSwipe}
      >
        <div className="absolute end-3 top-3">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={t.actions?.more || "More"}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        <div className="pe-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="max-w-[14rem] truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {entry.description || t.timesheet?.emptyDescription || "No description"}
                </p>
                {project && (
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs">
                    <span className="shrink-0 text-sky-600 dark:text-sky-400">{"•"}</span>
                    <span className={`max-w-[10rem] truncate font-medium ${project.isDeleted ? "italic text-slate-500 dark:text-slate-400" : "text-sky-600 dark:text-sky-400"}`}>
                      {project.isDeleted ? buildDeletedProjectLabel(project.name, deletedProjectLabel) : project.name}
                    </span>
                  </span>
                )}
                {project?.clientName && (
                  <span className="max-w-[8rem] truncate text-xs text-slate-500 dark:text-slate-400">
                    - {project.clientName}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>{formatTimeOnly(entry.start_time, lang)} - {formatTimeOnly(entry.end_time, lang)}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-base font-semibold text-slate-900 dark:text-white">{formatDuration(entry)}</p>
            </div>
          </div>

          {(entryTags.length > 0 || entry.is_billable) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {entryTags.length > 0 && (
                <span className="inline-flex min-w-0 items-center rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  {entryTags
                    .map((tag) => (tag.isDeleted ? buildDeletedTagLabel(tag.name, deletedTagLabel) : tag.name))
                    .join(" | ")}
                </span>
              )}
              {entry.is_billable && (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {menuOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={menuStyle}
            className="rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit(entry);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
              {t.actions?.edit || "Edit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestRestart(entry);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Play className="h-4 w-4" />
              {t.timesheet?.startTimer || "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete(entry);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              {t.actions?.delete || "Delete"}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function TimesheetSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="flex flex-1 flex-col gap-4 animate-pulse">
      <div className="hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/95 xl:block">
        <div className="flex items-center gap-2 px-3 py-3">
          <div className="h-12 flex-1 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-12 w-52 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-12 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-12 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-12 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 xl:hidden">
        <div className="space-y-3">
          <div className="h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-10 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-9 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-9 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-9 flex-1 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-9 w-9 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-9 w-9 rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-28 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>

      <div className="mb-1 flex items-center gap-3 text-slate-500 dark:text-slate-400">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
        <span className="text-sm font-medium">{loadingLabel}</span>
      </div>

      <div className="space-y-4">
        {[0, 1].map((weekIndex) => (
          <div key={weekIndex} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="h-4 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-28 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            {[0, 1].map((dayIndex) => (
              <div
                key={dayIndex}
                className="overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
              >
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/85">
                  <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="space-y-px bg-slate-200/80 dark:bg-slate-700/70">
                  {[0, 1].map((entryIndex) => (
                    <div key={entryIndex} className="bg-white px-4 py-4 dark:bg-slate-900/95">
                      <div className="flex items-center gap-4">
                        <div className="h-10 flex-1 rounded-lg bg-slate-200 dark:bg-slate-800" />
                        <div className="hidden h-10 w-28 rounded-lg bg-slate-200 dark:bg-slate-800 md:block" />
                        <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                        <div className="hidden h-10 w-20 rounded-lg bg-slate-200 dark:bg-slate-800 lg:block" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Timesheet() {
  const { t, lang } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRtl = lang === "fa";
  const supportsGroupedTimesheet = stageEnabled("14-timesheet");
  const supportsTimesheetFilters = stageEnabled("15-timesheet-filters");
  const extendedTimesheet = (t.timesheet as {
    deleteTitle?: string;
    deleteConfirmMessage?: string;
    saveSuccess?: string;
    saveError?: string;
    clearFilters?: string;
    customFromLabel?: string;
    customToLabel?: string;
    allClientsLabel?: string;
    allProjectsLabel?: string;
    allTagsLabel?: string;
    showFiltersLabel?: string;
    hideFiltersLabel?: string;
    applyFiltersLabel?: string;
    clientFilterPrefix?: string;
    projectFilterPrefix?: string;
    tagFilterPrefix?: string;
    fromFilterPrefix?: string;
    toFilterPrefix?: string;
    restartConfirmMessage?: string;
    discardConfirmMessage?: string;
    deletedProjectLabel?: string;
    deletedTagLabel?: string;
    searchTagsLabel?: string;
    noTagsFoundLabel?: string;
    searchProjectsLabel?: string;
    noProjectsFoundLabel?: string;
  }) || {};

  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [groupedHistory, setGroupedHistory] = useState<TimeEntryGroupWeek[]>([]);
  const [activeRunningEntry, setActiveRunningEntry] = useState<TimeEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchQuery = readStringParam(searchParams, "search", "");
  const filters = useMemo<TimeEntryFilters>(
    () => ({
      projectId: readStringParam(searchParams, "project", DEFAULT_ENTRY_FILTERS.projectId),
      clientId: readStringParam(searchParams, "client", DEFAULT_ENTRY_FILTERS.clientId),
      tagIds: readArrayParam(searchParams, "tags"),
      startedAfter: readStringParam(searchParams, "from", DEFAULT_ENTRY_FILTERS.startedAfter),
      startedBefore: readStringParam(searchParams, "to", DEFAULT_ENTRY_FILTERS.startedBefore),
    }),
    [searchParams],
  );
  const hasActiveHistoryFilters = supportsTimesheetFilters && Boolean(
    searchQuery ||
      filters.projectId ||
      filters.clientId ||
      filters.tagIds.length ||
      filters.startedAfter ||
      filters.startedBefore,
  );
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [limit] = useState(20);
  const [ticker, setTicker] = useState(() => performance.now());
  const [timerClockAnchor, setTimerClockAnchor] = useState<TimerClockAnchor | null>(null);

  const [modalMode, setModalMode] = useState<EntryModalMode>(null);
  const [formState, setFormState] = useState<EntryFormState>(EMPTY_FORM);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [timerDraft, setTimerDraft] = useState<TimerDraftState>(EMPTY_TIMER_DRAFT);
  const [isStartingTimer, setIsStartingTimer] = useState(false);
  const desktopTimerRef = useRef<HTMLDivElement>(null);
  const mobileTimerRef = useRef<HTMLDivElement>(null);
  const timerDraftSignatureRef = useRef(serializeTimerDraft(EMPTY_TIMER_DRAFT));
  const pendingTimerSignatureRef = useRef<string | null>(serializeTimerDraft(EMPTY_TIMER_DRAFT));
  const isTimerSavingRef = useRef(false);
  const timerEditorOwnerId = "running-timer-editor";

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; entry: TimeEntry | null }>({
    isOpen: false,
    entry: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [restartModal, setRestartModal] = useState<{ isOpen: boolean; entry: TimeEntry | null }>({
    isOpen: false,
    entry: null,
  });
  const [isRestarting, setIsRestarting] = useState(false);
  const [discardTimerModal, setDiscardTimerModal] = useState<{ isOpen: boolean; entry: TimeEntry | null }>({
    isOpen: false,
    entry: null,
  });
  const [isDiscardingTimer, setIsDiscardingTimer] = useState(false);

  const runningEntry = activeRunningEntry;
  const runningTimerNowMs = getAnchoredServerNowMs(timerClockAnchor, ticker);
  const deletedProjectLabel = extendedTimesheet.deletedProjectLabel || "Deleted project";
  const deletedTagLabel = extendedTimesheet.deletedTagLabel || "Deleted tag";
  const runningTimerProjects = useMemo(
    () => buildProjectOptionsForEntry(projects, runningEntry, timerDraft.projectId, deletedProjectLabel),
    [deletedProjectLabel, projects, runningEntry, timerDraft.projectId],
  );
  const runningTimerTags = useMemo(
    () => buildTagOptionsForEntry(tags, runningEntry, timerDraft.tags),
    [runningEntry, tags, timerDraft.tags],
  );
  const modalProjects = useMemo(
    () => buildProjectOptionsForEntry(projects, editingEntry, formState.projectId, deletedProjectLabel),
    [deletedProjectLabel, editingEntry, formState.projectId, projects],
  );
  const modalTags = useMemo(
    () => buildTagOptionsForEntry(tags, editingEntry, formState.tags),
    [editingEntry, formState.tags, tags],
  );

  useEffect(() => {
    if (!runningEntry) return;

    const intervalId = window.setInterval(() => setTicker(performance.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [runningEntry]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const loadOptions = async () => {
      try {
        const [projectsData, tagsData] = await Promise.all([
          getProjects(activeWorkspace.id, { limit: 100, offset: 0, ordering: "name" }),
          getTags(activeWorkspace.id, { limit: 100, offset: 0, ordering: "name" }),
        ]);

        setProjects((projectsData.results || []).filter((project: Project) => !project.is_archived));
        setTags(tagsData.results || []);
      } catch (error) {
        console.error(error);
        toast.error(t.timesheet?.optionsError || "Failed to load projects and tags");
      }
    };

    void loadOptions();
  }, [activeWorkspace?.id, t.timesheet?.optionsError]);

  useEffect(() => {
    setGroupedHistory([]);
    setNextOffset(0);
    setHasMoreHistory(false);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    setGroupedHistory([]);
    setNextOffset(0);
    setHasMoreHistory(false);
  }, [debouncedSearchQuery, filters]);

  useEffect(() => {
    if (!filters.clientId || !filters.projectId) return;

    const projectStillMatchesClient = projects.some(
      (project) => project.id === filters.projectId && project.client?.id === filters.clientId,
    );

    if (!projectStillMatchesClient) {
      setSearchParams(
        (current) =>
          updateQueryParams(current, { project: "" }, { project: "" }),
        { replace: true },
      );
    }
  }, [filters.clientId, filters.projectId, projects, setSearchParams]);

  const loadHistory = useCallback(async ({ offset = 0, append = false }: { offset?: number; append?: boolean } = {}) => {
    if (!activeWorkspace?.id) return;

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      const params: TimeEntryListParams = {
        limit,
        offset,
        status: "ended",
      };
      if (supportsTimesheetFilters) {
        params.search = debouncedSearchQuery;
        params.project = filters.projectId || undefined;
        params.client = filters.clientId || undefined;
        params.tags = filters.tagIds;
        params.started_after = filters.startedAfter || undefined;
        params.started_before = filters.startedBefore || undefined;
      }
      const data = await getTimeEntries(activeWorkspace.id, params);
      setGroupedHistory((current) => (append ? mergeGroupedHistory(current, data.groups || []) : (data.groups || [])));
      setHasMoreHistory(Boolean(data.has_more));
      setNextOffset(data.next_offset ?? null);
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.fetchError || "Failed to load time entries");
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [activeWorkspace?.id, debouncedSearchQuery, filters, limit, supportsTimesheetFilters, t.timesheet?.fetchError]);

  const loadRunningEntry = useCallback(async () => {
    if (!activeWorkspace?.id) {
      setActiveRunningEntry(null);
      setTimerClockAnchor(null);
      return;
    }

    try {
      const data = await getTimeEntries(activeWorkspace.id, {
        limit: 1,
        offset: 0,
        status: "running",
      });
      const entry = data.groups?.[0]?.days?.[0]?.entries?.[0] || null;
      setActiveRunningEntry(entry);
      setTimerClockAnchor(
        entry
          ? {
              serverNowMs: data.server_now_ms || entry.server_now_ms || Date.now(),
              performanceNowMs: performance.now(),
            }
          : null,
      );
    } catch (error) {
      console.error(error);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const timeoutId = window.setTimeout(() => {
      void loadHistory();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeWorkspace?.id, debouncedSearchQuery, limit, loadHistory, filters]);

  useEffect(() => {
    void loadRunningEntry();
  }, [loadRunningEntry]);

  useEffect(() => {
    if (!runningEntry) {
      setTimerClockAnchor(null);
      timerDraftSignatureRef.current = serializeTimerDraft(EMPTY_TIMER_DRAFT);
      pendingTimerSignatureRef.current = timerDraftSignatureRef.current;
      setTimerDraft(EMPTY_TIMER_DRAFT);
      return;
    }

    const nextDraft = buildTimerDraftState(runningEntry);
    timerDraftSignatureRef.current = serializeTimerDraft(nextDraft);
    pendingTimerSignatureRef.current = timerDraftSignatureRef.current;
    setTimerDraft(nextDraft);
  }, [runningEntry]);

  const isInsideTimerEditorContext = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    if (desktopTimerRef.current?.contains(target) || mobileTimerRef.current?.contains(target)) return true;
    return target instanceof Element && Boolean(target.closest(`[data-entry-editor-owner="${timerEditorOwnerId}"]`));
  }, [timerEditorOwnerId]);

  const commitTimerDraft = useCallback(async () => {
    const saveErrorText = extendedTimesheet.saveError || "Failed to save time entry";
    const saveSuccessText = extendedTimesheet.saveSuccess || "Time entry saved";

    if (!runningEntry) return false;

    const currentSignature = serializeTimerDraft(timerDraft);
    if (currentSignature === timerDraftSignatureRef.current) {
      return false;
    }

    if (isTimerSavingRef.current || pendingTimerSignatureRef.current === currentSignature) {
      return false;
    }

    isTimerSavingRef.current = true;
    pendingTimerSignatureRef.current = currentSignature;

    try {
      const updatedEntry = await updateTimeEntry(runningEntry.id, {
        description: timerDraft.description.trim(),
        project_id: timerDraft.projectId || null,
        tags: timerDraft.tags,
        is_billable: timerDraft.isBillable,
      });

      const syncedDraft = buildTimerDraftState(updatedEntry);
      const syncedSignature = serializeTimerDraft(syncedDraft);
      timerDraftSignatureRef.current = syncedSignature;
      pendingTimerSignatureRef.current = syncedSignature;
      setTimerDraft(syncedDraft);
      setActiveRunningEntry(updatedEntry);
      setTimerClockAnchor({
        serverNowMs: updatedEntry.server_now_ms || Date.now(),
        performanceNowMs: performance.now(),
      });
      toast.success(saveSuccessText);
      return true;
    } catch (error) {
      console.error(error);
      pendingTimerSignatureRef.current = null;
      toast.error(saveErrorText);
      return false;
    } finally {
      isTimerSavingRef.current = false;
    }
  }, [extendedTimesheet.saveError, extendedTimesheet.saveSuccess, runningEntry, timerDraft]);

  useEffect(() => {
    if (!runningEntry) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (isInsideTimerEditorContext(event.target)) return;
      void commitTimerDraft();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [commitTimerDraft, isInsideTimerEditorContext, runningEntry]);

  const handleTimerBlurCapture = () => {
    window.setTimeout(() => {
      if (isInsideTimerEditorContext(document.activeElement)) return;
      void commitTimerDraft();
    }, 0);
  };

  const closeCreateModal = () => {
    if (isSaving) return;
    setModalMode(null);
    setEditingEntry(null);
    setFormState(EMPTY_FORM);
  };

  const openCreateModal = () => {
    setModalMode("manual");
    setEditingEntry(null);
    setFormState(buildEntryFormState());
  };

  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setModalMode("edit");
    setFormState(buildEntryFormState(entry));
  };

  const handleSaveEntryModal = async () => {
    if (modalMode === "manual" && !activeWorkspace?.id) return;

    const { payload, error } = buildPayloadFromState(formState, {
      includeWorkspace: modalMode === "manual",
      workspaceId: activeWorkspace?.id,
    });

    if (!payload) {
      toast.error(error || (t.timesheet?.saveError || "Failed to save time entry"));
      return;
    }

    try {
      setIsSaving(true);
      if (modalMode === "edit" && editingEntry) {
        const updatedEntry = await updateTimeEntry(editingEntry.id, payload);
        setGroupedHistory((current) => updateGroupedHistoryEntry(current, updatedEntry));
        toast.success(t.timesheet?.updateSuccess || "Time entry updated successfully.");
      } else {
        if (!activeWorkspace?.id) return;
        await createTimeEntry(payload);
        toast.success(t.timesheet?.createSuccess || "Time entry created");
        await loadHistory();
        await loadRunningEntry();
      }
      setModalMode(null);
      setEditingEntry(null);
      setFormState(EMPTY_FORM);
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.saveError || "Failed to save time entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTimer = async () => {
    if (!activeWorkspace?.id || runningEntry) return;

    try {
      setIsStartingTimer(true);
      await createTimeEntry({
        workspace_id: activeWorkspace.id,
        description: timerDraft.description.trim(),
        project_id: timerDraft.projectId || null,
        tags: timerDraft.tags,
        is_billable: timerDraft.isBillable,
      });

      toast.success(t.timesheet?.startSuccess || "Timer started");
      await loadHistory();
      await loadRunningEntry();
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.saveError || "Failed to save time entry");
    } finally {
      setIsStartingTimer(false);
    }
  };

  const handleStop = async (entry: TimeEntry) => {
    try {
      await stopTimeEntry(entry.id);
      toast.success(t.timesheet?.stopSuccess || "Timer stopped");
      timerDraftSignatureRef.current = serializeTimerDraft(EMPTY_TIMER_DRAFT);
      setTimerDraft(EMPTY_TIMER_DRAFT);
      await loadHistory();
      await loadRunningEntry();
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.stopError || "Failed to stop timer");
    }
  };

  const handleRestartFromEntry = async (entry: TimeEntry) => {
    if (!activeWorkspace?.id || runningEntry) return;

    try {
      const restartProjectId = entry.project_details?.is_deleted ? null : entry.project;
      const restartTagIds = (entry.tag_details || [])
        .filter((tag) => !tag.is_deleted)
        .map((tag) => tag.id);
      await createTimeEntry({
        workspace_id: activeWorkspace.id,
        description: entry.description,
        project_id: restartProjectId,
        tags: restartTagIds,
        is_billable: entry.is_billable,
      });

      toast.success(t.timesheet?.startSuccess || "Timer started");
      await loadHistory();
      await loadRunningEntry();
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.saveError || "Failed to save time entry");
    }
  };

  const openDeleteModal = (entry: TimeEntry) => {
    setDeleteModal({ isOpen: true, entry });
  };

  const openRestartModal = (entry: TimeEntry) => {
    setRestartModal({ isOpen: true, entry });
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteModal({ isOpen: false, entry: null });
  };

  const closeRestartModal = () => {
    if (isRestarting) return;
    setRestartModal({ isOpen: false, entry: null });
  };

  const openDiscardTimerModal = () => {
    if (!runningEntry || isDiscardingTimer) return;
    setDiscardTimerModal({ isOpen: true, entry: runningEntry });
  };

  const closeDiscardTimerModal = () => {
    if (isDiscardingTimer) return;
    setDiscardTimerModal({ isOpen: false, entry: null });
  };

  const confirmDelete = async () => {
    if (!deleteModal.entry) return;

    try {
      setIsDeleting(true);
      await deleteTimeEntry(deleteModal.entry.id);
      toast.success(t.timesheet?.deleteSuccess || "Time entry deleted");
      setDeleteModal({ isOpen: false, entry: null });
      setGroupedHistory((current) =>
        current
          .map((week) => ({
            ...week,
            days: week.days
              .map((day) => ({
                ...day,
                entries: day.entries.filter((entry) => entry.id !== deleteModal.entry!.id),
              }))
              .filter((day) => day.entries.length > 0)
              .map((day) => ({ ...day, total_ms: day.entries.reduce((sum, item) => sum + getEntryDurationMs(item), 0) })),
          }))
          .filter((week) => week.days.length > 0)
          .map((week) => ({ ...week, total_ms: week.days.reduce((sum, day) => sum + day.total_ms, 0) })),
      );
      await loadRunningEntry();
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.deleteError || "Failed to delete time entry");
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmRestart = async () => {
    if (!restartModal.entry) return;

    try {
      setIsRestarting(true);
      await handleRestartFromEntry(restartModal.entry);
      setRestartModal({ isOpen: false, entry: null });
    } finally {
      setIsRestarting(false);
    }
  };

  const handleEntryUpdated = useCallback((updatedEntry: TimeEntry) => {
    setGroupedHistory((current) => updateGroupedHistoryEntry(current, updatedEntry));
    if (!updatedEntry.end_time) {
      setActiveRunningEntry(updatedEntry);
    }
  }, []);

  const handleApplyFilters = useCallback((nextFilters: TimeEntryFilters) => {
    setSearchParams(
      (current) =>
        updateQueryParams(
          current,
          {
            project: nextFilters.projectId,
            client: nextFilters.clientId,
            tags: nextFilters.tagIds,
            from: nextFilters.startedAfter,
            to: nextFilters.startedBefore,
          },
          {
            project: "",
            client: "",
            from: "",
            to: "",
          },
        ),
      { replace: true },
    );
  }, [setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setSearchParams(
      (current) =>
        updateQueryParams(
          current,
          {
            search: "",
            project: "",
            client: "",
            tags: [],
            from: "",
            to: "",
          },
          {
            search: "",
            project: "",
            client: "",
            from: "",
            to: "",
          },
        ),
      { replace: true },
    );
    setDebouncedSearchQuery("");
  }, [setSearchParams]);

  const handleLoadMore = useCallback(() => {
    if (!hasMoreHistory || nextOffset === null || isLoadingMore) return;
    void loadHistory({ offset: nextOffset, append: true });
  }, [hasMoreHistory, isLoadingMore, loadHistory, nextOffset]);

  const handleDiscardTimerDraft = useCallback(async () => {
    if (!discardTimerModal.entry || isDiscardingTimer) return;

    try {
      setIsDiscardingTimer(true);

      await deleteTimeEntry(discardTimerModal.entry.id);
      timerDraftSignatureRef.current = serializeTimerDraft(EMPTY_TIMER_DRAFT);
      setTimerDraft(EMPTY_TIMER_DRAFT);
      setActiveRunningEntry(null);
      setTimerClockAnchor(null);
      setDiscardTimerModal({ isOpen: false, entry: null });
      toast.success(t.timesheet?.deleteSuccess || "Time entry deleted");
      await loadHistory();
      await loadRunningEntry();
    } catch (error) {
      console.error(error);
      toast.error(t.timesheet?.deleteError || "Failed to delete time entry");
    } finally {
      setIsDiscardingTimer(false);
    }
  }, [discardTimerModal.entry, isDiscardingTimer, loadHistory, loadRunningEntry, t.timesheet?.deleteError, t.timesheet?.deleteSuccess]);

  if (!activeWorkspace) {
    return <div className="p-6 text-center text-slate-500">{t.timesheet?.selectWorkspace || t.clients.selectWorkspace}</div>;
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col bg-slate-100/70 p-4 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.timesheet?.title || 'Timesheets'}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.timesheet?.description(activeWorkspace?.name || "-") || 'Manage your Timesheet'}</p>
        </div>
      </div>

      <div
        ref={desktopTimerRef}
        onBlurCapture={handleTimerBlurCapture}
        className="mb-4 hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/95 xl:block"
      >
        <div className="flex min-w-0 items-center gap-2 px-3 py-3">
          <div className="min-w-0 flex-1">
            <Input
            value={timerDraft.description}
            placeholder={t.timesheet?.descriptionPlaceholder || "What are you working on?"}
            onChange={(event) => setTimerDraft((current) => ({ ...current, description: event.target.value }))}
            disabled={isStartingTimer}
            className="h-12 rounded-none border-0 bg-transparent px-5 text-sm shadow-none placeholder:text-slate-300 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:placeholder:text-slate-600"
            />
          </div>

          <div className="flex shrink-0 items-center">
            <SearchableSelect
              value={timerDraft.projectId}
              onChange={(value) => setTimerDraft((current) => ({ ...current, projectId: String(value) }))}
              options={[
                { value: "", label: t.timesheet?.projectLabel || "Project" },
                ...runningTimerProjects.map((project) => ({
                  value: project.id,
                  label: project.name,
                  searchText: project.client?.name || "",
                })),
              ]}
              placeholder={t.timesheet?.projectLabel || "Project"}
              searchPlaceholder={extendedTimesheet.searchProjectsLabel || t.projects?.searchPlaceholder || "Search projects..."}
              emptyLabel={extendedTimesheet.noProjectsFoundLabel || "No projects found."}
              className="min-w-[190px] max-w-[220px]"
              buttonClassName="h-12 w-full rounded-none border-0 bg-transparent px-3 text-sm text-sky-600 shadow-none outline-none dark:bg-transparent dark:text-sky-400 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isStartingTimer}
            />
          </div>

          <div className="flex min-w-0 shrink items-center">
            <TagMultiSelect
              tags={runningTimerTags}
              selectedTags={timerDraft.tags}
              onToggleTag={(tagId) =>
                setTimerDraft((current) => ({ ...current, tags: toggleTagId(current.tags, tagId) }))
              }
              emptyHint={t.timesheet?.noTagsHint || "Create tags first from the Tags page."}
              title={t.tags?.title || "Tags"}
              compact
              portalOwnerId={timerEditorOwnerId}
              className="max-w-[240px]"
              buttonClassName="max-w-[240px]"
            />
          </div>

          <div className="flex shrink-0 items-center">
            <BillableIconButton
              checked={timerDraft.isBillable}
              onChange={(checked) => setTimerDraft((current) => ({ ...current, isBillable: checked }))}
              label={t.timesheet?.billable || "Billable"}
              disabled={isStartingTimer}
              compact
            />
          </div>

          <div className="flex h-12 shrink-0 items-center px-5 text-lg font-semibold text-slate-900 dark:text-white">
            {runningEntry ? formatDuration(runningEntry, runningTimerNowMs) : "00:00:00"}
          </div>

          <div className="ms-2 flex shrink-0 items-center gap-2">
            {runningEntry ? (
              <>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => void handleStop(runningEntry)}
                  className="h-12 w-12 rounded-md"
                  title={t.timesheet?.stopTimer || "Stop"}
                  aria-label={t.timesheet?.stopTimer || "Stop"}
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={openDiscardTimerModal}
                  disabled={isDiscardingTimer}
                  className="h-12 w-12 rounded-md"
                  title={(t.actions as { discard?: string } | undefined)?.discard || "Discard"}
                  aria-label={(t.actions as { discard?: string } | undefined)?.discard || "Discard"}
                >
                  {isDiscardingTimer ? "..." : <Trash2 className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => void handleStartTimer()}
                disabled={isStartingTimer}
                size="icon"
                className="h-12 w-12 rounded-md"
                title={t.timesheet?.startTimer || "Start"}
                aria-label={t.timesheet?.startTimer || "Start"}
              >
                {isStartingTimer ? "..." : <Play className="h-4 w-4 fill-current" />}
              </Button>
            )}
          </div>

        </div>
      </div>

      <div
        ref={mobileTimerRef}
        onBlurCapture={handleTimerBlurCapture}
        className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 xl:hidden"
      >
        <div className="space-y-3">
          <Input
            value={timerDraft.description}
            placeholder={t.timesheet?.descriptionPlaceholder || "What are you working on?"}
            onChange={(event) => setTimerDraft((current) => ({ ...current, description: event.target.value }))}
            disabled={isStartingTimer}
            className="h-10 border-slate-200 bg-slate-50 text-sm placeholder:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-600"
          />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <SearchableSelect
              value={timerDraft.projectId}
              onChange={(value) => setTimerDraft((current) => ({ ...current, projectId: String(value) }))}
              options={[
                { value: "", label: t.timesheet?.projectLabel || "Project" },
                ...runningTimerProjects.map((project) => ({
                  value: project.id,
                  label: project.name,
                  searchText: project.client?.name || "",
                })),
              ]}
              placeholder={t.timesheet?.projectLabel || "Project"}
              searchPlaceholder={extendedTimesheet.searchProjectsLabel || t.projects?.searchPlaceholder || "Search projects..."}
              emptyLabel={extendedTimesheet.noProjectsFoundLabel || "No projects found."}
              className="w-full"
              buttonClassName="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm shadow-none outline-none dark:border-slate-700 dark:bg-slate-900 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isStartingTimer}
            />

            <div className="flex h-10 min-w-[110px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              {runningEntry ? formatDuration(runningEntry, runningTimerNowMs) : "00:00:00"}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TagMultiSelect
                tags={runningTimerTags}
                selectedTags={timerDraft.tags}
                onToggleTag={(tagId) =>
                  setTimerDraft((current) => ({ ...current, tags: toggleTagId(current.tags, tagId) }))
                }
                emptyHint={t.timesheet?.noTagsHint || "Create tags first from the Tags page."}
                title={t.tags?.title || "Tags"}
                compact
                portalOwnerId={timerEditorOwnerId}
              />

              <BillableIconButton
                checked={timerDraft.isBillable}
                onChange={(checked) => setTimerDraft((current) => ({ ...current, isBillable: checked }))}
                label={t.timesheet?.billable || "Billable"}
                disabled={isStartingTimer}
                compact
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {runningEntry ? (
                <>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => void handleStop(runningEntry)}
                    className="h-10 w-10 rounded-md"
                    title={t.timesheet?.stopTimer || "Stop"}
                    aria-label={t.timesheet?.stopTimer || "Stop"}
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={openDiscardTimerModal}
                    disabled={isDiscardingTimer}
                    className="h-10 w-10 rounded-md"
                    title={(t.actions as { discard?: string } | undefined)?.discard || "Discard"}
                    aria-label={(t.actions as { discard?: string } | undefined)?.discard || "Discard"}
                  >
                    {isDiscardingTimer ? "..." : <Trash2 className="h-4 w-4" />}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => void handleStartTimer()}
                  disabled={isStartingTimer}
                  size="icon"
                  className="h-10 w-10 rounded-md"
                  title={t.timesheet?.startTimer || "Start"}
                  aria-label={t.timesheet?.startTimer || "Start"}
                >
                  {isStartingTimer ? "..." : <Play className="h-4 w-4 fill-current" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {supportsTimesheetFilters ? (
        <div className="mb-10">
          <TimesheetFilterBar
            searchQuery={searchQuery}
            filters={filters}
            onSearchChange={(value) =>
              setSearchParams(
                (current) =>
                  updateQueryParams(current, { search: value }, { search: "" }),
                { replace: true },
              )
            }
            onApply={handleApplyFilters}
            onClearFilters={handleClearFilters}
            projects={projects}
            tags={tags}
            searchPlaceholder={t.timesheet?.searchPlaceholder || "Search time entries..."}
            labels={{
              project: t.timesheet?.projectLabel || "Project",
              client: t.projects?.clientLabel || "Client",
              tags: t.tags?.title || "Tags",
              clear: extendedTimesheet.clearFilters || "Clear filters",
              customFrom: extendedTimesheet.customFromLabel || "From date",
              customTo: extendedTimesheet.customToLabel || "To date",
              allClients: extendedTimesheet.allClientsLabel || "All clients",
              allProjects: extendedTimesheet.allProjectsLabel || "All projects",
              allTags: extendedTimesheet.allTagsLabel || "All tags",
              showFilters: extendedTimesheet.showFiltersLabel || "Show filters",
              hideFilters: extendedTimesheet.hideFiltersLabel || "Hide filters",
              apply: extendedTimesheet.applyFiltersLabel || "Apply",
              clientPrefix: extendedTimesheet.clientFilterPrefix || "Client",
              projectPrefix: extendedTimesheet.projectFilterPrefix || "Project",
              tagPrefix: extendedTimesheet.tagFilterPrefix || "Tag",
              fromPrefix: extendedTimesheet.fromFilterPrefix || "From",
              toPrefix: extendedTimesheet.toFilterPrefix || "To",
              searchTags: extendedTimesheet.searchTagsLabel || t.tags?.searchPlaceholder || "Search tags...",
              noTagsFound: extendedTimesheet.noTagsFoundLabel || "No tags found.",
            }}
          />
        </div>
      ) : (
        <div className="mb-10 rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
          {supportsGroupedTimesheet
            ? "Grouped timesheet history is available in this stage. Search and filters unlock in the next exercise."
            : "Timer actions and manual time entries are available in this stage. The frontend groups the available entries locally until the grouped API unlocks in the next exercise."}
        </div>
      )}

      {isLoading ? (
        <TimesheetSkeleton loadingLabel={t.loading || "Loading..."} />
      ) : (
        <InfiniteScroll
          className="flex flex-1 flex-col"
          onLoadMore={handleLoadMore}
          hasMore={hasMoreHistory}
          isLoading={isLoadingMore}
        >
          <div className="mb-6 space-y-4">
            {groupedHistory.map((week) => (
              <div key={week.key} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatWeekRange(new Date(`${week.week_start}T00:00:00`), lang)}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.workspace?.weekTotal}: <span className="font-semibold text-slate-800 dark:text-slate-100">{formatDurationMs(week.total_ms)}</span>
                  </p>
                </div>

                {week.days.map((day) => (
                  <div key={day.key} className="border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/85">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatDayLabel(new Date(`${day.date}T00:00:00`), lang)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDurationMs(day.total_ms)}</span>
                      </p>
                    </div>

                    <div>
                      {day.entries.map((entry) => (
                        <div key={entry.id}>
                          <div className="hidden xl:block">
                            <RecordedEntryCard
                              entry={entry}
                              t={t}
                              projects={projects}
                              tags={tags}
                              onDelete={openDeleteModal}
                              onRestart={handleRestartFromEntry}
                              onEntryUpdated={handleEntryUpdated}
                              lang={lang}
                            />
                          </div>
                          <div className="xl:hidden">
                            <MobileRecordedEntryCard
                              entry={entry}
                              t={t}
                              projects={projects}
                              tags={tags}
                              onEdit={openEditModal}
                              onDelete={openDeleteModal}
                              onRequestRestart={openRestartModal}
                              lang={lang}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {groupedHistory.length === 0 && (
              <EmptyStateCard
                icon={Clock3}
                title={t.timesheet?.emptyState || "No time entries found"}
                description={
                  hasActiveHistoryFilters
                    ? t.timesheet?.noEntriesSearch || "Try adjusting your search query or filters."
                    : t.timesheet?.emptyStateDescription || "Start the timer to get started."
                }
                className="min-h-[50vh] border-slate-200 bg-white/60 py-16 dark:border-slate-700 dark:bg-slate-900/60"
              />
            )}
          </div>
        </InfiniteScroll>
      )}

      <Modal
        isOpen={modalMode === "manual" || modalMode === "edit"}
        onClose={closeCreateModal}
        title={modalMode === "edit" ? (t.timesheet?.editTitle || "Edit Time Entry") : (t.timesheet?.createTitle || "Add Time Entry")}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreateModal}>
              {t.actions?.cancel || "Cancel"}
            </Button>
            <Button onClick={() => void handleSaveEntryModal()} disabled={isSaving}>
              {isSaving ? "..." : (modalMode === "edit" ? (t.save || "Save") : (t.create || "Create"))}
            </Button>
          </>
        }
      >
        <EntryEditorFields
          state={formState}
          onChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
          onToggleTag={(tagId) => setFormState((current) => ({ ...current, tags: toggleTagId(current.tags, tagId) }))}
          projects={modalProjects}
          tags={modalTags}
          t={t}
          isRtl={isRtl}
        />
      </Modal>

      {deleteModal.entry && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          title={extendedTimesheet.deleteTitle || t.timesheet?.deleteTitle || "Delete Time Entry"}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={closeDeleteModal}>
                {t.actions?.cancel || "Cancel"}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "..." : (t.actions?.delete || "Delete")}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {extendedTimesheet.deleteConfirmMessage || t.timesheet?.deleteConfirmMessage || "Are you sure you want to delete this time entry?"}
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-medium text-slate-900 dark:text-white">
                {deleteModal.entry.description || t.timesheet?.emptyDescription || "No description"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatDateTime(deleteModal.entry.start_time, lang)}
                {deleteModal.entry.end_time ? ` - ${formatDateTime(deleteModal.entry.end_time, lang)}` : ""}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {restartModal.entry && (
        <Modal
          isOpen={restartModal.isOpen}
          onClose={closeRestartModal}
          title={t.timesheet?.startTimer || "Start"}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={closeRestartModal}>
                {t.actions?.cancel || "Cancel"}
              </Button>
              <Button onClick={() => void confirmRestart()} disabled={isRestarting}>
                {isRestarting ? "..." : (t.timesheet?.startTimer || "Start")}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {extendedTimesheet.restartConfirmMessage || t.timesheet?.restartConfirmMessage || "Start a new running timer from this entry?"}
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-medium text-slate-900 dark:text-white">
                {restartModal.entry.description || t.timesheet?.emptyDescription || "No description"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatDateTime(restartModal.entry.start_time, lang)}
                {restartModal.entry.end_time ? ` - ${formatDateTime(restartModal.entry.end_time, lang)}` : ""}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {discardTimerModal.entry && (
        <Modal
          isOpen={discardTimerModal.isOpen}
          onClose={closeDiscardTimerModal}
          title={(t.actions as { discard?: string } | undefined)?.discard || "Discard"}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={closeDiscardTimerModal}>
                {t.actions?.cancel || "Cancel"}
              </Button>
              <Button variant="destructive" onClick={() => void handleDiscardTimerDraft()} disabled={isDiscardingTimer}>
                {isDiscardingTimer ? "..." : ((t.actions as { discard?: string } | undefined)?.discard || "Discard")}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {extendedTimesheet.discardConfirmMessage || t.timesheet?.discardConfirmMessage || "Are you sure you want to discard this running timer?"}
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-medium text-slate-900 dark:text-white">
                {discardTimerModal.entry.description || t.timesheet?.emptyDescription || "No description"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatDateTime(discardTimerModal.entry.start_time, lang)}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
