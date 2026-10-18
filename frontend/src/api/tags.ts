import { authFetch, buildApiError } from "./client";
import { cachedGetJson, invalidateApiCache } from "./cache";

interface UserSummary {
  id: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
}

export interface Tag {
  id: string;
  workspace: string;
  name: string;
  color: string;
  is_deleted?: boolean;
  created_by?: UserSummary | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const getTags = async (
  workspaceId: string,
  params: { limit?: number; offset?: number; search?: string; ordering?: string } = {},
): Promise<PaginatedResponse<Tag>> => {
  const query = new URLSearchParams({ workspace: workspaceId });

  if (params.limit !== undefined) query.append("limit", String(params.limit));
  if (params.offset !== undefined) query.append("offset", String(params.offset));
  if (params.search) query.append("search", params.search);
  if (params.ordering) query.append("ordering", params.ordering);

  return cachedGetJson(`/api/tags/?${query.toString()}`, {
    ttlMs: 5 * 60 * 1000,
    namespaces: ["tags"],
  });
};

export const createTag = async (workspaceId: string, data: { name: string; color: string }) => {
  const response = await authFetch("/api/tags/", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: workspaceId,
      ...data,
    }),
  });
  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["tags"]);
  return payload;
};

export const updateTag = async (id: string, data: Partial<Pick<Tag, "name" | "color">>) => {
  const response = await authFetch(`/api/tags/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await buildApiError(response);
  const payload = await response.json();
  invalidateApiCache(["tags"]);
  return payload;
};

export const deleteTag = async (id: string) => {
  const response = await authFetch(`/api/tags/${id}/`, {
    method: "DELETE",
  });
  if (!response.ok) throw await buildApiError(response);
  invalidateApiCache(["tags"]);
};
