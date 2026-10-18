import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { getProjects, deleteProject, type Project } from "../api/projects";
import { getErrorMessage } from "../api/client";
import { invalidateApiCache } from "../api/cache";
import { getClients } from "../api/clients";
import { useAppContext } from "../context/AppContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { ProjectCreateModal } from "../components/projects/ProjectCreateModal";
import { ProjectEditModal } from "../components/projects/ProjectEditModal";
import { Pagination } from "../components/Pagination";
import { Plus, Building2, Pencil, Trash2, X } from "lucide-react";

import EmptyStateCard from "../components/EmptyStateCard";
import FilterBar from "../components/FilterBar";
import { ListPageSkeleton } from "../components/ListPageSkeleton";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Modal } from "../components/Modal";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { SearchableSelect } from "../components/ui/SearchableSelect";
import {
  PROJECTS_ARCHIVE,
  PROJECTS_CREATE,
  PROJECTS_EDIT,
  canDeleteWorkspaceResource,
  canWorkspace,
} from "../lib/permissions";
import {
  readBooleanParam,
  readNumberParam,
  readStringParam,
  updateQueryParams,
} from "../lib/queryParams";

export const Projects: React.FC = () => {
  const { t, lang } = useTranslation();
  const { user } = useAppContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceRole = activeWorkspace?.my_role;
  const canCreateProject = canWorkspace(workspaceRole, PROJECTS_CREATE);
  const canEditProject = canWorkspace(workspaceRole, PROJECTS_EDIT);
  const canArchiveProject = canWorkspace(workspaceRole, PROJECTS_ARCHIVE);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const search = useMemo(() => readStringParam(searchParams, "search", ""), [searchParams]);
  const ordering = useMemo(
    () => readStringParam(searchParams, "ordering", "-created_at"),
    [searchParams],
  );
  const isArchived = useMemo(
    () => readBooleanParam(searchParams, "archived", false),
    [searchParams],
  );
  const selectedClientId = useMemo(
    () => readStringParam(searchParams, "client", ""),
    [searchParams],
  );
  const currentPage = useMemo(
    () => Math.max(1, readNumberParam(searchParams, "page", 1)),
    [searchParams],
  );
  const limit = useMemo(
    () => Math.max(1, readNumberParam(searchParams, "limit", 10)),
    [searchParams],
  );
  const [totalItems, setTotalItems] = useState(0);

  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean; project: Project | null}>({isOpen: false, project: null});
  const [deleteInput, setDeleteInput] = useState('');

  const orderingOptions = [
    { value: '-created_at', label: t.ordering?.createdAtDesc || 'Newest First' },
    { value: 'created_at', label: t.ordering?.createdAt || 'Oldest First' },
    { value: 'name', label: t.ordering?.name || 'Name (A-Z)' },
    { value: '-name', label: t.ordering?.nameDesc || 'Name (Z-A)' },
  ];

  const fetchProjectList = async (options: { bypassCache?: boolean } = {}) => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const offset = (currentPage - 1) * limit;
      const data = await getProjects(activeWorkspace.id, { 
        limit, 
        offset, 
        search, 
        client: selectedClientId || undefined,
        is_archived: isArchived,
        ordering,
        bypassCache: options.bypassCache,
      });
      const items = data?.results || (Array.isArray(data) ? data : [])
      const count = data?.count !== undefined ? data.count : items.length
      setProjects(items);
      setTotalItems(count)
    } catch (error) {
      console.error("Failed to fetch projects", error);
      toast.error(getErrorMessage(error, t.projects?.fetchError || "Failed to fetch projects."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    getClients(activeWorkspace.id, "", "name", 300, 0)
      .then((data: any) => {
        const items = data?.results || (Array.isArray(data) ? data : []);
        setClients(items.map((client: { id: string; name: string }) => ({ id: client.id, name: client.name })));
      })
      .catch((error) => {
        console.error(error);
        toast.error(t.projects?.clientFetchError || "Failed to load clients.");
        setClients([]);
      });
  }, [activeWorkspace?.id, t.projects?.clientFetchError]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void fetchProjectList();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [activeWorkspace?.id, currentPage, limit, search, isArchived, ordering, selectedClientId]);

  useEffect(() => {
    const handleCreated = () => void fetchProjectList();
    const handleUpdated = () => void fetchProjectList();
    
    window.addEventListener("project_created", handleCreated);
    window.addEventListener("project_updated", handleUpdated);
    
    return () => {
      window.removeEventListener("project_created", handleCreated);
      window.removeEventListener("project_updated", handleUpdated);
    };
  }, [activeWorkspace?.id, currentPage, limit, search, isArchived, ordering, selectedClientId]);

  const confirmDelete = async () => {
    if (!deleteModal.project) return;
    try {
      const deletedId = deleteModal.project.id;
      await deleteProject(deletedId);
      
      setProjects((current) => current.filter((project) => project.id !== deletedId));
      setTotalItems((current) => Math.max(current - 1, 0));
      setDeleteModal({ isOpen: false, project: null });
      setDeleteInput('');

      await fetchProjectList({ bypassCache: true });

      window.dispatchEvent(new CustomEvent('project_deleted', { 
        detail: { id: deletedId } 
      }));

      toast.success(t.projects?.deleteSuccess || 'Project deleted successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, t.projects?.deleteError || 'Failed to delete project'));
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      return new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", {
        dateStyle: "long",
        timeZone: "Asia/Tehran",
      }).format(date)
    } catch {
      return dateStr
    }
  }

  const sortedClients = useMemo(() => {
    if (!selectedClientId) return clients;
    const selected = clients.filter((client) => client.id === selectedClientId);
    const unselected = clients.filter((client) => client.id !== selectedClientId);
    return [...selected, ...unselected];
  }, [clients, selectedClientId]);

  const clientOptions = useMemo(
    () =>
      sortedClients.map((client) => ({
        value: client.id,
        label: client.name,
      })),
    [sortedClients],
  );

  const hasActiveProjectFilters = Boolean(selectedClientId) || isArchived;

  const updateListParams = (
    updates: Record<string, string | number | boolean | null | undefined | string[]>,
  ) => {
    setSearchParams(
      (current) =>
        updateQueryParams(current, updates, {
          search: "",
          ordering: "-created_at",
          archived: false,
          page: 1,
          limit: 10,
        }),
      { replace: true },
    );
  };

  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t.projects?.selectWorkspace || t.clients.selectWorkspace}
        </div>
      </div>
    );
  }


  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 md:p-6">
      <div className="flex flex-1 flex-col gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.projects?.title || 'Projects'}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.projects?.description(activeWorkspace.name) || 'Manage your projects'}</p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            {canCreateProject && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="icon"
                className="shrink-0 shadow-sm"
                title={t.projects?.createNew || 'Create New'}
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <FilterBar 
          searchQuery={search}
          setSearchQuery={(value) => updateListParams({ search: value, page: 1 })}
          ordering={ordering}
          setOrdering={(value) => updateListParams({ ordering: value, page: 1 })}
          orderingOptions={orderingOptions}
          searchPlaceholder={t.projects?.searchPlaceholder || 'Search projects...'}
        />

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] lg:flex-1">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {t.projects?.filterClients || "Filter by client"}
              </div>
              <SearchableSelect
                value={selectedClientId}
                onChange={(value) => updateListParams({ client: value, page: 1 })}
                options={clientOptions}
                placeholder="All clients"
                searchPlaceholder="Search clients..."
                emptyLabel={t.clients?.noClients || "No clients found"}
                buttonClassName="min-h-11 w-full rounded-xl border-slate-200 bg-slate-50/80 dark:border-slate-700"
              />
            </div>

            {canArchiveProject ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t.projects?.archived || "Archived Projects"}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isArchived}
                  aria-label={t.projects?.archived || "Archived Projects"}
                  onClick={() => {
                    invalidateApiCache(["projects"]);
                    updateListParams({ archived: !isArchived, page: 1 });
                  }}
                  className={`inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition md:w-auto ${
                    isArchived
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
                      : "border-slate-200 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                  }`}
                >
                  <span>{t.projects?.archived || "Archived Projects"}</span>
                  <span
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                      isArchived ? "bg-amber-500 dark:bg-amber-400" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        isArchived ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5 rtl:-translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              updateListParams({ client: null, archived: false, page: 1 });
            }}
            disabled={!hasActiveProjectFilters}
            aria-label={t.projects?.clearClientFilters || "Clear filters"}
            className={`inline-flex h-10 w-10 items-center justify-center self-start rounded-xl border text-sm transition lg:self-end ${
              hasActiveProjectFilters
                ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                : "border-slate-200 bg-white text-slate-400 opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
            } disabled:cursor-not-allowed`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <ListPageSkeleton variant="standard-grid" />
      ) : (
        <div className="flex flex-1 flex-col gap-6">
          {projects.length === 0 ? (
            <EmptyStateCard
              icon={Building2}
              title={t.projects?.emptyState || "No projects found"}
              description={t.projects?.noProjectsSearch || t.projects?.emptyState || "No projects found"}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {projects.map((project) => {
                const canDeleteProject = canDeleteWorkspaceResource({
                  workspaceRole,
                  currentUserId: user?.id,
                  createdById: project.created_by?.id,
                });

                return (
                  <Card key={project.id} className="shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 text-sm font-semibold text-white dark:border-slate-700"
                            style={{ backgroundColor: project.color || "#3B82F6" }}
                          >
                            {project.thumbnail ? (
                              <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover" />
                            ) : (
                              project.name.trim().charAt(0).toUpperCase() || "P"
                            )}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base text-slate-900 dark:text-white">{project.name}</CardTitle>
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {project.client ? `${t.projects?.client || "Client"}: ${project.client.name}` : t.projects?.noClient || "No client"}
                            </div>
                          </div>
                        </div>

                        {(canEditProject || canDeleteProject) && (
                          <div className="flex shrink-0 items-center gap-1">
                            {canEditProject && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingProject(project)}
                                className="h-8 w-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                                title={t.actions?.edit || "Edit"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}

                            {canDeleteProject && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteModal({ isOpen: true, project })}
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
                          {project.description || t.workspace?.noDescription || "No description"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          <span>{formatDate(project.created_at)}</span>
                          {project.is_archived ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold tracking-[0.1em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              {t.projects?.archived || "Archived Projects"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalCount={totalItems}
            limit={limit}
            onPageChange={(page) => updateListParams({ page })}
            onLimitChange={(pageLimit) => updateListParams({ limit: pageLimit, page: 1 })}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}
      </div>

      {/* Modals */}
      {canCreateProject && isCreateModalOpen && (
        <ProjectCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
      
      {canEditProject && editingProject && (
        <ProjectEditModal
          project={editingProject}
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
        />
      )}


      {deleteModal.project && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => {
            setDeleteModal({ isOpen: false, project: null });
            setDeleteInput('');
          }}
          title={t.projects?.deleteTitle || 'Delete Project'}
          maxWidth="max-w-md"
          footer={
            <>
              <Button 
                variant="secondary"
                onClick={() => { 
                  setDeleteModal({ isOpen: false, project: null }); 
                  setDeleteInput(''); 
                }} 
                className="rounded-xl font-semibold"
              >
                {t.actions?.cancel || 'Cancel'}
              </Button>
              <Button 
                variant="destructive"
                disabled={deleteInput !== deleteModal.project.name}
                onClick={confirmDelete} 
                className="rounded-xl font-semibold"
              >
                {t.actions?.delete || 'Delete'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              {t.projects?.deleteWarning || 'To confirm deletion, please type the project name:'} <strong className="text-slate-900 dark:text-white select-all">{deleteModal.project.name}</strong>
            </p>
            
            <Input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteModal.project.name}
            />
          </div>
        </Modal>
      )}

    </div>
  );

};
