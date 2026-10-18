import { authFetch, buildApiError } from "./client";
import { cachedGetJson, invalidateApiCache } from "./cache";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string | null;
  owner?: string;
  my_role?: 'owner' | 'admin' | 'member';
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface WorkspaceMembership {
  id: string;
  workspace: string;
  user: {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    mobile?: string;
    profile_picture?: string | null;
    [key: string]: any;
  };
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
  joined_at?: string;
  [key: string]: any;
}


type QueryValue = string | number | boolean | undefined | null;

const toQueryString = (params?: Record<string, QueryValue>) => {
  if (!params) return "";
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
};

export const fetchWorkspaces = async (params?: Record<string, QueryValue>): Promise<PaginatedResponse<Workspace>> => {
  const query = toQueryString(params);
  const url = `/api/workspaces/${query ? `?${query}` : ''}`;
  const data = await cachedGetJson<any>(url, {
    ttlMs: 60 * 1000,
    namespaces: ["workspaces"],
  });

  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  
  return {
    count: data.count || data.results?.length || 0,
    next: data.next || null,
    previous: data.previous || null,
    results: data.results || data
  };
};

export const getWorkspace = async (id: string): Promise<Workspace> => {
  const response = await authFetch(`/api/workspaces/${id}/`);
  if (!response.ok) throw await buildApiError(response);
  return await response.json();
};

export const createWorkspace = async (data: {
  name: string;
  description: string;
  members?: any[];
  thumbnail?: File | null;
}): Promise<Workspace> => {
  const hasFile = data.thumbnail instanceof File;
  const body = hasFile
    ? (() => {
        const formData = new FormData();
        formData.append("name", data.name);
        formData.append("description", data.description);
        if (Array.isArray(data.members)) {
          formData.append("members", JSON.stringify(data.members));
        }
        if (data.thumbnail) {
          formData.append("thumbnail", data.thumbnail);
        }
        return formData;
      })()
    : JSON.stringify({
        name: data.name,
        description: data.description,
        members: data.members,
      });

  const response = await authFetch('/api/workspaces/', {
    method: 'POST',
    body,
  });

  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["workspaces", "workspace-memberships"]);
  return payload;
};

export const updateWorkspace = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    thumbnail?: File | null;
    clear_thumbnail?: boolean;
  },
): Promise<Workspace> => {
  const hasFile = data.thumbnail instanceof File;
  const shouldClear = Boolean(data.clear_thumbnail);
  const useForm = hasFile || shouldClear;
  const jsonPayload = Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
      if (key === "thumbnail") return value instanceof File;
      if (key === "clear_thumbnail") return Boolean(value);
      return value !== undefined;
    }),
  );
  const body = useForm
    ? (() => {
        const formData = new FormData();
        if (data.name !== undefined) formData.append("name", data.name);
        if (data.description !== undefined) formData.append("description", data.description);
        if (data.thumbnail) formData.append("thumbnail", data.thumbnail);
        if (shouldClear) formData.append("clear_thumbnail", "true");
        return formData;
      })()
    : JSON.stringify(jsonPayload);

  const response = await authFetch(`/api/workspaces/${id}/`, {
    method: 'PATCH',
    body,
  });

  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["workspaces"]);
  return payload;
};

export const deleteWorkspace = async (id: string): Promise<void> => {
  const response = await authFetch(`/api/workspaces/${id}/`, {
    method: 'DELETE',
  });

  if (!response.ok) throw await buildApiError(response);
  invalidateApiCache(["workspaces", "workspace-memberships"]);
};

export const fetchWorkspaceMemberships = async (
  params?: Record<string, QueryValue>,
  options?: { bypassCache?: boolean },
): Promise<PaginatedResponse<WorkspaceMembership>> => {
  const queryParams = toQueryString(params);
  const data = await cachedGetJson<any>(`/api/workspace-memberships/?${queryParams.toString()}`, {
    ttlMs: 5 * 60 * 1000,
    namespaces: ["workspace-memberships"],
    bypass: options?.bypassCache,
  });
  
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  
  return {
    count: data.count || data.results?.length || 0,
    next: data.next || null,
    previous: data.previous || null,
    results: data.results || data
  };
};

export const addWorkspaceMembership = async (data: { workspace: string; user: string; role: string }) => {
  const response = await authFetch(`/api/workspace-memberships/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) throw await buildApiError(response);

  const payload = await response.json();
  invalidateApiCache(["workspace-memberships"]);
  return payload;
};

export const removeWorkspaceMembership = async (membershipId: string): Promise<void> => {
  const response = await authFetch(`/api/workspace-memberships/${membershipId}/`, {
    method: 'DELETE',
  });

  if (!response.ok) throw await buildApiError(response);
  invalidateApiCache(["workspace-memberships"]);
};

export const updateWorkspaceMembership = async (membershipId: string | number, data: { role: string }) => {
  const response = await authFetch(`/api/workspace-memberships/${membershipId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) throw await buildApiError(response);

  const payload = await response.json();
  invalidateApiCache(["workspace-memberships"]);
  return payload;
};
