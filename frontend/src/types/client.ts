interface AuditUser {
  id: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
}

export interface Client {
  id: string;
  name: string;
  notes: string | null;
  thumbnail?: string | null;
  workspace: string;
  created_by?: AuditUser | null;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedClientList {
  count: number;
  next: string | null;
  previous: string | null;
  results: Client[];
}
