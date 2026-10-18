import { authFetch, buildApiError } from "./client";
import { invalidateApiCache } from "./cache";

export interface TimeEntryProjectDetails {
  id: string;
  name: string;
  is_deleted: boolean;
  client_name: string | null;
}

export interface TimeEntryTagDetails {
  id: string;
  name: string;
  color: string;
  is_deleted: boolean;
}

export interface TimeEntry {
  id: string;
  workspace: string;
  user: string;
  project: string | null;
  project_details: TimeEntryProjectDetails | null;
  description: string;
  start_time: string;
  start_time_ms: number;
  end_time: string | null;
  end_time_ms: number | null;
  server_now_ms: number;
  duration: string | null;
  duration_seconds?: number | null;
  tags: string[];
  tag_details: TimeEntryTagDetails[];
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryGroupDay {
  key: string;
  date: string;
  total_ms: number;
  entries: TimeEntry[];
}

export interface TimeEntryGroupWeek {
  key: string;
  week_start: string;
  week_end: string;
  total_ms: number;
  days: TimeEntryGroupDay[];
}

interface GroupedTimeEntryResponse {
  items_per_page: number;
  current_page_items_count: number;
  total_items: number;
  offset: number;
  next_offset: number | null;
  has_more: boolean;
  server_now_ms: number;
  server_now: string;
  groups: TimeEntryGroupWeek[];
}

interface PaginatedTimeEntryResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TimeEntry[];
}

export interface TimeEntryPayload {
  workspace_id?: string;
  project_id?: string | null;
  description?: string;
  start_time?: string;
  end_time?: string | null;
  tags?: string[];
  is_billable?: boolean;
}

export interface TimeEntryListParams {
  limit?: number;
  offset?: number;
  search?: string;
  status?: "running" | "ended" | "all";
  project?: string;
  client?: string;
  tags?: string[];
  started_after?: string;
  started_before?: string;
}

const parseEntryTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dayKeyForEntry = (entry: TimeEntry) => {
  const parsed = parseEntryTime(entry.start_time);
  if (!parsed) return "unknown";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const durationMsForEntry = (entry: TimeEntry) => {
  if (entry.duration_seconds !== null && entry.duration_seconds !== undefined) {
    return entry.duration_seconds * 1000;
  }

  const start = parseEntryTime(entry.start_time)?.getTime();
  const end = parseEntryTime(entry.end_time)?.getTime();
  if (!start || !end) return 0;
  return Math.max(0, end - start);
};

const flattenGroupedEntries = (groups: TimeEntryGroupWeek[] = []) =>
  groups.flatMap((group) => group.days || []).flatMap((day) => day.entries || []);

const normalizeRawEntries = (data: GroupedTimeEntryResponse | PaginatedTimeEntryResponse | TimeEntry[]) => {
  if (Array.isArray(data)) return data;
  if ("groups" in data && Array.isArray(data.groups)) return flattenGroupedEntries(data.groups);
  if ("results" in data && Array.isArray(data.results)) return data.results;
  return [];
};

const applyClientSideFilters = (entries: TimeEntry[], workspaceId: string, params: TimeEntryListParams) => {
  const search = params.search?.trim().toLowerCase();
  const tagIds = new Set((params.tags || []).map(String));
  const startedAfter = parseEntryTime(params.started_after)?.getTime();
  const startedBefore = parseEntryTime(params.started_before)?.getTime();

  return entries.filter((entry) => {
    if (String(entry.workspace) !== String(workspaceId)) return false;
    if (params.status === "running" && entry.end_time) return false;
    if (params.status === "ended" && !entry.end_time) return false;
    if (params.project && String(entry.project || "") !== String(params.project)) return false;
    if (tagIds.size > 0 && !(entry.tags || []).some((tagId) => tagIds.has(String(tagId)))) return false;

    const startMs = parseEntryTime(entry.start_time)?.getTime();
    if (startedAfter && (!startMs || startMs < startedAfter)) return false;
    if (startedBefore && (!startMs || startMs > startedBefore)) return false;

    if (search) {
      const projectName = entry.project_details?.name || "";
      const tagNames = (entry.tag_details || []).map((tag) => tag.name).join(" ");
      const haystack = `${entry.description || ""} ${projectName} ${tagNames}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
};

const groupEntriesForTimesheet = (
  entries: TimeEntry[],
  data: GroupedTimeEntryResponse | PaginatedTimeEntryResponse | TimeEntry[],
): GroupedTimeEntryResponse => {
  const groupsByDay = new Map<string, { total_ms: number; entries: TimeEntry[] }>();

  entries.forEach((entry) => {
    const key = dayKeyForEntry(entry);
    const group = groupsByDay.get(key) || { total_ms: 0, entries: [] };
    group.entries.push(entry);
    group.total_ms += durationMsForEntry(entry);
    groupsByDay.set(key, group);
  });

  const groups = Array.from(groupsByDay.entries())
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .map(([key, group]) => {
      const sortedEntries = [...group.entries].sort((left, right) => {
        const leftMs = parseEntryTime(left.start_time)?.getTime() || 0;
        const rightMs = parseEntryTime(right.start_time)?.getTime() || 0;
        return rightMs - leftMs;
      });

      return {
        key,
        week_start: key,
        week_end: key,
        total_ms: group.total_ms,
        days: [{
          key,
          date: key,
          total_ms: group.total_ms,
          entries: sortedEntries,
        }],
      };
    });

  const serverNow = new Date();
  const hasGroupedShape = !Array.isArray(data) && "groups" in data;
  const hasPaginatedShape = !Array.isArray(data) && "results" in data;

  return {
    items_per_page: hasGroupedShape ? data.items_per_page : entries.length,
    current_page_items_count: entries.length,
    total_items: entries.length,
    offset: hasGroupedShape ? data.offset : 0,
    next_offset: hasGroupedShape ? data.next_offset : null,
    has_more: hasGroupedShape ? data.has_more : Boolean(hasPaginatedShape && data.next),
    server_now_ms: hasGroupedShape ? data.server_now_ms : serverNow.getTime(),
    server_now: hasGroupedShape ? data.server_now : serverNow.toISOString(),
    groups,
  };
};

export const getTimeEntries = async (
  workspaceId: string,
  params: TimeEntryListParams = {},
): Promise<GroupedTimeEntryResponse> => {
  const query = new URLSearchParams({ workspace: workspaceId });

  if (params.limit !== undefined) query.append("limit", String(params.limit));
  if (params.offset !== undefined) query.append("offset", String(params.offset));
  if (params.search) query.append("search", params.search);
  if (params.status) query.append("status", params.status);
  if (params.project) query.append("project", params.project);
  if (params.client) query.append("client", params.client);
  if (params.started_after) query.append("started_after", params.started_after);
  if (params.started_before) query.append("started_before", params.started_before);
  if (params.tags?.length) {
    params.tags.forEach((tagId) => query.append("tags", tagId));
  }

  const response = await authFetch(`/api/time-entries/?${query.toString()}`);
  if (!response.ok) throw await buildApiError(response);
  const data = await response.json();
  const entries = applyClientSideFilters(normalizeRawEntries(data), workspaceId, params);
  return groupEntriesForTimesheet(entries, data);
};

export const createTimeEntry = async (payload: TimeEntryPayload) => {
  const response = await authFetch("/api/time-entries/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await buildApiError(response);
  const data = await response.json();
  invalidateApiCache(["time-entries"]);
  return data;
};

export const updateTimeEntry = async (id: string, payload: TimeEntryPayload) => {
  const response = await authFetch(`/api/time-entries/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await buildApiError(response);
  const data = await response.json();
  invalidateApiCache(["time-entries"]);
  return data;
};

export const stopTimeEntry = async (id: string, endTime?: string) => {
  const response = await authFetch(`/api/time-entries/${id}/stop/`, {
    method: "POST",
    body: JSON.stringify(endTime ? { end_time: endTime } : {}),
  });
  if (!response.ok) throw await buildApiError(response);
  const data = await response.json();
  invalidateApiCache(["time-entries"]);
  return data;
};

export const deleteTimeEntry = async (id: string) => {
  const response = await authFetch(`/api/time-entries/${id}/`, {
    method: "DELETE",
  });
  if (!response.ok) throw await buildApiError(response);
  invalidateApiCache(["time-entries"]);
};
