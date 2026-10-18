import { authFetch, buildApiError } from "./client";
import { cachedGetJson, invalidateApiCache } from "./cache";

export interface Client {
  id: string
  name: string
  notes?: string
  thumbnail?: string | null
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const getClients = async (
  workspaceId: string, 
  search: string = "", 
  ordering: string = "", 
  limit: number = 10, 
  offset: number = 0
): Promise<PaginatedResponse<Client>> => {
  const queryParams = new URLSearchParams({ 
    workspace: workspaceId,
    limit: limit.toString(),
    offset: offset.toString()
  });

  if (search) queryParams.append("search", search);
  if (ordering) queryParams.append("ordering", ordering);

  return cachedGetJson<PaginatedResponse<Client>>(`/api/clients/?${queryParams.toString()}`, {
    ttlMs: 5 * 60 * 1000,
    namespaces: ["clients"],
  });
};

const buildClientBody = (
  workspaceId: string | null,
  data: { name?: string; notes?: string; thumbnail?: File | null; clear_thumbnail?: boolean },
) => {
  const hasFile = data.thumbnail instanceof File;
  const shouldClear = Boolean(data.clear_thumbnail);
  if (!hasFile && !shouldClear) {
    const payload = Object.fromEntries(
      Object.entries({
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        ...data,
      }).filter(([key, value]) => {
        if (key === "thumbnail") return value instanceof File;
        if (key === "clear_thumbnail") return false;
        return value !== undefined;
      }),
    );
    return {
      body: JSON.stringify(payload),
    };
  }

  const formData = new FormData();
  if (workspaceId) formData.append("workspace_id", workspaceId);
  if (data.name !== undefined) formData.append("name", data.name);
  if (data.notes !== undefined) formData.append("notes", data.notes);
  if (data.thumbnail) formData.append("thumbnail", data.thumbnail);
  if (shouldClear) formData.append("clear_thumbnail", "true");
  return { body: formData };
};

export const createClient = async (workspaceId: string, data: { name: string; notes: string; thumbnail?: File | null }) => {
  const requestBody = buildClientBody(workspaceId, data);
  const response = await authFetch("/api/clients/", {
    method: "POST",
    body: requestBody.body,
  });
  
  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["clients"]);
  return payload;
};

export const updateClient = async (
  id: string,
  data: { name?: string; notes?: string; thumbnail?: File | null; clear_thumbnail?: boolean },
) => {
  const requestBody = buildClientBody(null, data);
  const response = await authFetch(`/api/clients/${id}/`, {
    method: "PATCH",
    body: requestBody.body,
  });

  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["clients"]);
  return payload;
};

export const deleteClient = async (id: string) => {
  const response = await authFetch(`/api/clients/${id}/`, {
    method: "DELETE",
  });

  if (!response.ok) throw await buildApiError(response);
  invalidateApiCache(["clients"]);
  
  if (response.status === 204) {
    return { success: true };
  }
  
  return response.json().catch(() => ({ success: true }));
};
