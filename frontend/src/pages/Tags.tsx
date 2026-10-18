import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Edit2, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createTag, deleteTag, getTags, type Tag, updateTag } from "../api/tags";
import { getErrorMessage } from "../api/client";
import EmptyStateCard from "../components/EmptyStateCard";
import { useAppContext } from "../context/AppContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useTranslation } from "../hooks/useTranslation";
import { TAGS_CREATE, TAGS_EDIT, canDeleteWorkspaceResource, canWorkspace } from "../lib/permissions";
import FilterBar from "../components/FilterBar";
import { ListPageSkeleton } from "../components/ListPageSkeleton";
import { Modal } from "../components/Modal";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { readNumberParam, readStringParam, updateQueryParams } from "../lib/queryParams";

const DEFAULT_COLOR = "#3B82F6";

export default function Tags() {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceRole = activeWorkspace?.my_role;
  const canCreateTag = canWorkspace(workspaceRole, TAGS_CREATE);
  const canEditTag = canWorkspace(workspaceRole, TAGS_EDIT);
  const [searchParams, setSearchParams] = useSearchParams();

  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const searchQuery = readStringParam(searchParams, "search", "");
  const ordering = readStringParam(searchParams, "ordering", "-updated_at");
  const currentPage = Math.max(1, readNumberParam(searchParams, "page", 1));
  const limit = Math.max(1, readNumberParam(searchParams, "limit", 10));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(DEFAULT_COLOR);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; tag: Tag | null }>({ isOpen: false, tag: null });

  const orderingOptions = [
    { value: "-updated_at", label: t.ordering?.updatedAtDesc || "Recently Updated" },
    { value: "-created_at", label: t.ordering?.createdAtDesc || "Newest First" },
    { value: "created_at", label: t.ordering?.createdAt || "Oldest First" },
    { value: "name", label: t.ordering?.name || "Name (A-Z)" },
    { value: "-name", label: t.ordering?.nameDesc || "Name (Z-A)" },
  ];

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const timeoutId = setTimeout(() => {
      void loadTags();
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [activeWorkspace?.id, searchQuery, ordering, currentPage, limit]);

  const loadTags = async () => {
    if (!activeWorkspace?.id) return;

    try {
      setIsLoading(true);
      const data = await getTags(activeWorkspace.id, {
        limit,
        offset: (currentPage - 1) * limit,
        ordering,
        search: searchQuery,
      });
      setTags(data.results || []);
      setTotalItems(data.count || 0);
    } catch (error) {
      console.error(error);
      toast.error(t.tags?.fetchError || "Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setFormName("");
    setFormColor(DEFAULT_COLOR);
    setIsModalOpen(true);
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color || DEFAULT_COLOR);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingTag(null);
    setFormName("");
    setFormColor(DEFAULT_COLOR);
  };

  const handleSubmit = async () => {
    if (!activeWorkspace?.id || !formName.trim()) return;

    try {
      setIsSaving(true);

      if (editingTag) {
        await updateTag(editingTag.id, { name: formName.trim(), color: formColor });
        toast.success(t.tags?.updateSuccess || "Tag updated");
      } else {
        await createTag(activeWorkspace.id, { name: formName.trim(), color: formColor });
        toast.success(t.tags?.createSuccess || "Tag created");
      }

      closeModal();
      await loadTags();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, t.tags?.saveError || "Failed to save tag"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    try {
      await deleteTag(tag.id);
      toast.success(t.tags?.deleteSuccess || "Tag deleted");
      await loadTags();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, t.tags?.deleteError || "Failed to delete tag"));
    }
  };

  const updateListParams = (updates: Record<string, string | number | null | undefined>) => {
    setSearchParams(
      (current) =>
        updateQueryParams(current, updates, {
          search: "",
          ordering: "-updated_at",
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
          {t.tags?.selectWorkspace || t.clients.selectWorkspace}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 md:p-6">
      <div className="flex flex-1 flex-col gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.tags?.title || "Tags"}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t.tags?.description?.(activeWorkspace.name) || `Manage tags for ${activeWorkspace.name}`}
              </p>
            </div>
            {canCreateTag && (
              <Button onClick={openCreateModal} size="icon" className="shrink-0 shadow-sm" title={t.tags?.create || "Create Tag"}>
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
            searchPlaceholder={t.tags?.searchPlaceholder || "Search tags..."}
          />
        </div>

        {isLoading ? (
          <ListPageSkeleton variant="list" />
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            {tags.length === 0 ? (
              <EmptyStateCard
                icon={TagIcon}
                title={t.tags?.emptyState || "No tags found"}
                description={searchQuery ? t.tags?.noTagsSearch : t.tags?.emptyState || "No tags found"}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {tags.map((tag) => {
                  const canDeleteTag = canDeleteWorkspaceResource({
                    workspaceRole,
                    currentUserId: user?.id,
                    createdById: tag.created_by?.id,
                  });

                  return (
                    <Card
                      key={tag.id}
                      className="flex flex-col text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <CardContent className="flex h-full flex-col justify-between gap-4 px-5 py-4">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700"
                                style={{ backgroundColor: tag.color || DEFAULT_COLOR }}
                              />
                              <CardTitle className="text-lg line-clamp-1">{tag.name}</CardTitle>
                            </div>
                          </div>

                          {(canEditTag || canDeleteTag) && (
                            <div className="flex shrink-0 items-center gap-2">
                              {canDeleteTag && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteModal({ isOpen: true, tag })}
                                  className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                  title={t.actions?.delete || "Delete"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}

                              {canEditTag && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(tag)}
                                  className="h-8 w-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                                  title={t.actions?.edit || "Edit"}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
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
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTag ? (t.tags?.editTitle || "Edit Tag") : (t.tags?.createTitle || "Create Tag")}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              {t.actions?.cancel || "Cancel"}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSaving || !formName.trim()}>
              {isSaving ? "..." : (editingTag ? (t.save || "Save") : (t.create || "Create"))}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t.tags?.nameLabel || "Tag name"}
            </label>
            <Input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder={t.tags?.namePlaceholder || "Design"} />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t.tags?.colorLabel || "Color"}
            </label>
            <input type="color" value={formColor} onChange={(event) => setFormColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-slate-200 dark:border-slate-700 bg-transparent" />
          </div>
        </div>
      </Modal>

      {deleteModal.tag && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, tag: null })}
          title={t.tags?.deleteTitle || "Delete Tag"}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false, tag: null })}>
                {t.actions?.cancel || "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!deleteModal.tag) return;
                  void handleDelete(deleteModal.tag);
                  setDeleteModal({ isOpen: false, tag: null });
                }}
              >
                {t.actions?.delete || "Delete"}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {(t.tags?.deleteConfirmMessage as ((name: string) => string) | undefined)?.(deleteModal.tag.name) ||
              `Are you sure you want to delete "${deleteModal.tag.name}"?`}
          </p>
        </Modal>
      )}
    </div>
  );
}
