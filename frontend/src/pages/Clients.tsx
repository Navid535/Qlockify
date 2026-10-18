import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Building2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useWorkspace } from "../context/WorkspaceContext" 
import { useAppContext } from "../context/AppContext"
import { useTranslation } from "../hooks/useTranslation" 
import {
  CLIENTS_CREATE,
  CLIENTS_EDIT,
  canDeleteWorkspaceResource,
  canWorkspace,
} from "../lib/permissions"
import { type Client } from "../types/client"
import { getClients } from "../api/clients"
import CreateClientModal from "../components/CreateClientModal"
import EditClientModal from "../components/EditClientModal"
import DeleteClientModal from "../components/DeleteClientModal"
import EmptyStateCard from "../components/EmptyStateCard"
import FilterBar from "../components/FilterBar"
import { ListPageSkeleton } from "../components/ListPageSkeleton"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardTitle } from "../components/ui/card"
import { Pagination } from "../components/Pagination"
import { readNumberParam, readStringParam, updateQueryParams } from "../lib/queryParams"

export default function Clients() {
  const { activeWorkspace } = useWorkspace()
  const { user } = useAppContext()
  const [clients, setClients] = useState<Client[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [totalItems, setTotalItems] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchQuery = readStringParam(searchParams, "search", "")
  const ordering = readStringParam(searchParams, "ordering", "-created_at")
  const currentPage = Math.max(1, readNumberParam(searchParams, "page", 1))
  const limit = Math.max(1, readNumberParam(searchParams, "limit", 10))
  
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)
  
  const { t, lang } = useTranslation()
  const isFa = lang === "fa"
  const workspaceRole = activeWorkspace?.my_role
  const canCreateClient = canWorkspace(workspaceRole, CLIENTS_CREATE)
  const canEditClient = canWorkspace(workspaceRole, CLIENTS_EDIT)

  const orderingOptions = [
    { value: "-created_at", label: t.ordering?.createdAtDesc || "Newest First" },
    { value: "created_at", label: t.ordering?.createdAt || "Oldest First" },
    { value: "name", label: t.ordering?.name || "Name (A-Z)" },
    { value: "-name", label: t.ordering?.nameDesc || "Name (Z-A)" },
    { value: "-updated_at", label: t.ordering?.updatedAtDesc || "Recently Updated" },
  ]

  // Debounce search input to avoid spamming the API
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const fetchClientsList = async () => {
    if (!activeWorkspace?.id) {
      setIsLoading(false) 
      return
    }
    
    setIsLoading(true)
    try {
      const offset = (currentPage - 1) * limit
      const data: any = await getClients(activeWorkspace.id, debouncedSearch, ordering, limit, offset)
      
      const items = data?.results || (Array.isArray(data) ? data : [])
      const count = data?.count !== undefined ? data.count : items.length
      
      setClients(items)
      setTotalItems(count)
    } catch (error) {
      console.error(t.clients.errors.fetchFailed, error)
      toast.error(t.clients.errors.fetchFailed)
      setClients([]) 
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      return new Intl.DateTimeFormat(isFa ? "fa-IR" : "en-US", {
        dateStyle: "long",
        timeZone: "Asia/Tehran"
      }).format(date)
    } catch (e) {
      return dateStr
    }
  }

  useEffect(() => {
    fetchClientsList()
  }, [activeWorkspace?.id, debouncedSearch, ordering, currentPage, limit])

  const updateListParams = (updates: Record<string, string | number | null | undefined>) => {
    setSearchParams(
      (current) =>
        updateQueryParams(current, updates, {
          search: "",
          ordering: "-created_at",
          page: 1,
          limit: 10,
        }),
      { replace: true },
    )
  }

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t.clients.selectWorkspace}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 md:p-6">
      <div className="flex flex-1 flex-col gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.clients.title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.clients.description(activeWorkspace.name)}
            </p>
          </div>

          {canCreateClient && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="icon"
              className="shrink-0 shadow-sm"
              title={t.clients.addClient}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <FilterBar
          searchQuery={searchQuery}
          setSearchQuery={(value) => updateListParams({ search: value, page: 1 })}
          ordering={ordering}
          setOrdering={(value) => updateListParams({ ordering: value, page: 1 })}
          orderingOptions={orderingOptions}
          searchPlaceholder={t.clients.searchPlaceholder}
        />
      </div>

      {isLoading ? (
        <ListPageSkeleton variant="standard-grid" />
      ) : (
        <div className="flex flex-1 flex-col gap-6">
          {clients.length === 0 ? (
            <EmptyStateCard
              icon={Building2}
              title={t.clients.noClients}
              description={searchQuery ? t.clients.noClientsSearch : t.clients.noClientsAdd}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {clients.map((client) => {
                const canDeleteClient = canDeleteWorkspaceResource({
                  workspaceRole,
                  currentUserId: user?.id,
                  createdById: client.created_by?.id,
                })

                return (
                  <Card key={client.id} className="shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {client.thumbnail ? (
                              <img src={client.thumbnail} alt={client.name} className="h-full w-full rounded-xl object-cover" />
                            ) : (
                              client.name.trim().charAt(0).toUpperCase() || "C"
                            )}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base text-slate-900 dark:text-white">{client.name}</CardTitle>
                          </div>
                        </div>

                        {(canEditClient || canDeleteClient) && (
                          <div className="flex shrink-0 items-center gap-1">
                            {canEditClient && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditClient(client)}
                                className="h-8 w-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                                title={t.actions?.edit || "Edit"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeleteClient && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteClient(client)}
                                className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                title={t.actions?.delete || "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="min-h-[3.75rem] text-sm leading-6 text-slate-600 line-clamp-3 dark:text-slate-300">
                          {client.notes || t.workspace?.noDescription || "No description"}
                        </p>
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t.clients.addedOn}: {formatDate(client.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {clients.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalCount={totalItems}
              limit={limit}
              onPageChange={(page) => updateListParams({ page })}
              onLimitChange={(pageLimit) => updateListParams({ limit: pageLimit, page: 1 })}
            />
          )}
        </div>
      )}
      </div>

      {canCreateClient && (
        <CreateClientModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchClientsList}
          workspaceId={activeWorkspace.id}
        />
      )}

      {canEditClient && (
        <EditClientModal
          isOpen={!!editClient}
          onClose={() => setEditClient(null)}
          onSuccess={fetchClientsList}
          client={editClient}
        />
      )}

      {!!deleteClient && (
        <DeleteClientModal
          isOpen={!!deleteClient}
          onClose={() => setDeleteClient(null)}
          onSuccess={fetchClientsList}
          client={deleteClient}
        />
      )}
    </div>
  )
}
