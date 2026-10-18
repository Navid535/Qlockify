import { authFetch, buildApiError } from "./client";
import { cachedGetJson, invalidateApiCache } from "./cache";

interface UserSummary {
  id: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
}

export interface ProjectClient {
  id: string;
  name: string;
  thumbnail?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  thumbnail?: string | null;
  created_at?: string;
  is_archived: boolean;
  is_deleted?: boolean;
  workspace: string;
  created_by?: UserSummary | null;
  client: ProjectClient | null;
}

export interface ProjectPayload {
  name: string;
  description: string;
  color: string;
  is_archived: boolean;
  workspace: string;
  client: string | null;
  thumbnail?: File | null;
  clear_thumbnail?: boolean;
}

const buildProjectBody = (data: Partial<ProjectPayload> & { workspace?: string; name?: string }) => {
  const hasFile = data.thumbnail instanceof File;
  const shouldClear = Boolean(data.clear_thumbnail);
  if (!hasFile && !shouldClear) {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => {
        if (key === "thumbnail") return value instanceof File;
        if (key === "clear_thumbnail") return false;
        return value !== undefined;
      }),
    );
    return { body: JSON.stringify(payload) };
  }

  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || key === "clear_thumbnail") return;
    if (key === "thumbnail" && value instanceof File) {
      formData.append(key, value);
      return;
    }
    formData.append(key, String(value));
  });
  if (shouldClear) formData.append("clear_thumbnail", "true");
  return { body: formData };
};

export const getProjects = async (
  workspaceId: string,
  params: {
    limit?: number;
    offset?: number;
    search?: string;
    client?: string;
    clients?: string[];
    is_archived?: boolean;
    ordering?: string;
    bypassCache?: boolean;
  } = {}
) => {
  const queryParams = new URLSearchParams({ workspace: workspaceId });

  if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
  if (params.offset !== undefined) queryParams.append("offset", params.offset.toString());
  if (params.search) queryParams.append("search", params.search);
  if (params.client) queryParams.append("client", params.client);
  params.clients?.forEach((clientId) => queryParams.append("clients", clientId));
  if (params.is_archived !== undefined) queryParams.append("is_archived", params.is_archived.toString());
  if (params.ordering !== undefined) queryParams.append("ordering", params.ordering.toString());

  const data = await cachedGetJson<any>(`/api/projects/?${queryParams.toString()}`, {
    ttlMs: 5 * 60 * 1000,
    namespaces: ["projects"],
    bypass: params.bypassCache,
  });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) {
    return {
      ...data,
      results: data.items,
      count: data.total_items ?? data.items.length,
    };
  }
  return data;
};

export const getProject = async (id: string) => {
  const response = await authFetch(`/api/projects/${id}/`);
  
  if (!response.ok) throw await buildApiError(response);
  return response.json();
};

export const createProject = async (
  data: Partial<ProjectPayload> & { workspace: string; name: string }
) => {
  const requestBody = buildProjectBody(data);
  const response = await authFetch("/api/projects/", {
    method: "POST",
    body: requestBody.body,
  });

  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["projects"]);
  return payload;
};

export const updateProject = async (
  id: string,
  data: Partial<ProjectPayload>
) => {
  const requestBody = buildProjectBody(data);
  const response = await authFetch(`/api/projects/${id}/`, {
    method: "PATCH",
    body: requestBody.body,
  });

  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["projects"]);
  return payload;
};

export const deleteProject = async (id: string) => {
  const response = await authFetch(`/api/projects/${id}/`, {
    method: "DELETE",
  });

  if (!response.ok) throw await buildApiError(response);
  invalidateApiCache(["projects"]);
  
  if (response.status === 204) return { success: true };
  return response.json().catch(() => ({ success: true }));
};

export const toggleArchiveProject = async (id: string, isArchived?: boolean) => {
  const endpoint = isArchived ? "unarchive" : "archive";
  const response = await authFetch(`/api/projects/${id}/${endpoint}/`, {
    method: "POST",
  });

  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["projects"]);
  return payload;
};
