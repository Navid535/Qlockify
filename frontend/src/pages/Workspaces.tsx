import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, Eye, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWorkspaces, deleteWorkspace, type Workspace } from '../api/workspaces';
import { useTranslation } from '../hooks/useTranslation';
import {
  WORKSPACE_DELETE,
  WORKSPACE_EDIT,
  canWorkspace,
  type WorkspaceRole,
} from '../lib/permissions';
import FilterBar from '../components/FilterBar';
import EmptyStateCard from '../components/EmptyStateCard';
import { ListPageSkeleton } from '../components/ListPageSkeleton';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardTitle } from '../components/ui/card';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { readNumberParam, readStringParam, updateQueryParams } from '../lib/queryParams';

const RoleBadge = ({ role }: { role?: WorkspaceRole }) => {
  const { t } = useTranslation();
  if (!role) return null;
  
  const styles: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    guest: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[role] || styles.guest}`}>
      {role ? t.workspace?.roles[role] : "-"}
    </span>
  );
};

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean; workspace: Workspace | null}>({isOpen: false, workspace: null});
  const [deleteInput, setDeleteInput] = useState('');

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const searchQuery = readStringParam(searchParams, 'search', '');
  const ordering = readStringParam(searchParams, 'ordering', '-created_at');
  const currentPage = Math.max(1, readNumberParam(searchParams, 'page', 1));
  const limit = Math.max(1, readNumberParam(searchParams, 'limit', 10));

  const orderingOptions = [
    { value: '-created_at', label: t.ordering?.createdAtDesc || 'Newest First' },
    { value: 'created_at', label: t.ordering?.createdAt || 'Oldest First' },
    { value: 'name', label: t.ordering?.name || 'Name (A-Z)' },
    { value: '-name', label: t.ordering?.nameDesc || 'Name (Z-A)' },
    { value: '-updated_at', label: t.ordering?.updatedAtDesc || 'Recently Updated' },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWorkspaces();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, ordering, currentPage, limit]);

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string | number> = {
        limit: limit,
        offset: (currentPage - 1) * limit,
      };
      
      if (searchQuery) params.search = searchQuery;
      if (ordering) params.ordering = ordering;
      
      const data = await fetchWorkspaces(params as any);
      
      const items = Array.isArray(data) ? data : (data?.results || []);
      const count = !Array.isArray(data) && data?.count !== undefined ? data.count : items.length;
      
      setWorkspaces(items);
      setTotalItems(count);
    } catch (error) {
      toast.error(t.workspace?.fetchError || 'Error fetching workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.workspace) return;
    try {
      const deletedId = deleteModal.workspace.id;
      await deleteWorkspace(deletedId);
      
      loadWorkspaces(); 

      window.dispatchEvent(new CustomEvent('workspace_deleted', { 
        detail: { id: deletedId } 
      }));

      toast.success(t.workspace?.deleteSuccess || 'Workspace deleted successfully');
      setDeleteModal({ isOpen: false, workspace: null });
      setDeleteInput('');
    } catch (error) {
      toast.error(t.workspace?.deleteError || 'Failed to delete workspace');
    }
  };

  const updateListParams = (updates: Record<string, string | number | null | undefined>) => {
    setSearchParams(
      (current) =>
        updateQueryParams(current, updates, {
          search: '',
          ordering: '-created_at',
          page: 1,
          limit: 10,
        }),
      { replace: true },
    );
  };

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 md:p-6">
      <div className="flex flex-1 flex-col gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.workspace?.title || 'Workspaces'}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.workspace?.subtitle || 'Manage your workspaces'}</p>
          </div>
          <Button
            onClick={() => navigate('/workspaces/create')}
            size="icon"
            className="shrink-0 shadow-sm"
            title={t.workspace?.createNew || 'Create New'}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <FilterBar 
          searchQuery={searchQuery}
          setSearchQuery={(value) => updateListParams({ search: value, page: 1 })}
          ordering={ordering}
          setOrdering={(value) => updateListParams({ ordering: value, page: 1 })}
          orderingOptions={orderingOptions}
          searchPlaceholder={t.workspace?.searchPlaceholder || 'Search...'}
        />
      </div>

      {isLoading ? (
        <ListPageSkeleton variant="list" />
      ) : (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex flex-1 flex-col gap-4">
            {workspaces.map((workspace) => {
              const canDeleteWorkspace = canWorkspace(workspace.my_role, WORKSPACE_DELETE);
              const canEditWorkspace = canWorkspace(workspace.my_role, WORKSPACE_EDIT);

              return (
                <Card key={workspace.id} className="flex flex-col text-slate-800 dark:text-slate-100 dark:bg-slate-800 dark:border-slate-700 shadow-sm">
                  <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 px-6 gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {workspace.thumbnail ? (
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <img src={workspace.thumbnail} alt={workspace.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {workspace.name.trim().charAt(0).toUpperCase() || "W"}
                          </div>
                        )}
                        <CardTitle className="text-lg line-clamp-1">
                          {workspace.name}
                        </CardTitle>
                          <RoleBadge role={workspace.my_role} />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                        {workspace.description || t.workspace?.noDescription || 'No description'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canDeleteWorkspace && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setDeleteModal({ isOpen: true, workspace })}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                          title={t.actions?.delete || 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}

                      {canEditWorkspace && (
                      <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/workspaces/${workspace.id}/edit`)}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20"
                          title={t.actions?.edit || 'Edit'}
                          >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        size="icon"
                        onClick={() => navigate(`/workspaces/${workspace.id}`)}
                        className="h-8 w-8 hover:bg-blue-700 dark:hover:bg-blue-500 border-none shadow-sm transition-all"
                        title={t.actions?.view || 'View'}
                      >
                        <Eye className="h-4 w-4 rtl:-scale-x-100" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {workspaces.length === 0 && (
              <EmptyStateCard
                icon={LayoutDashboard}
                title={t.workspace.noWorkspace}
                description={searchQuery ? t.workspace.noWorkspaceSearch : t.workspace?.emptyState || t.workspace.noWorkspace}
              />
            )}
          </div>

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

      {deleteModal.workspace && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => {
            setDeleteModal({ isOpen: false, workspace: null });
            setDeleteInput('');
          }}
          title={t.workspace?.deleteTitle || 'Delete Workspace'}
          maxWidth="max-w-md"
          footer={
            <>
              <Button 
                variant="secondary"
                onClick={() => { 
                  setDeleteModal({ isOpen: false, workspace: null }); 
                  setDeleteInput(''); 
                }} 
                className="rounded-xl font-semibold"
              >
                {t.actions?.cancel || 'Cancel'}
              </Button>
              <Button 
                variant="destructive"
                disabled={deleteInput !== deleteModal.workspace.name}
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
              {t.workspace?.deleteWarning || 'To confirm deletion, please type the workspace name:'} <strong className="text-slate-900 dark:text-white select-all">{deleteModal.workspace.name}</strong>
            </p>
            
            <Input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteModal.workspace.name}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
