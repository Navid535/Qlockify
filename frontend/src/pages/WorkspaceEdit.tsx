import React, { useState, useEffect, useRef, Fragment, useMemo, useCallback } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { AlertCircle, ShieldCheck, UserPlus, Trash2, Shield, UploadCloud } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'sonner';
import {
  updateWorkspace,
  addWorkspaceMembership,
  removeWorkspaceMembership,
  updateWorkspaceMembership,
  fetchWorkspaceMemberships,
  getWorkspace
} from '../api/workspaces';
import { getErrorMessage } from '../api/client';
import { searchUserByExactMobile, type SearchedUser } from '../api/users';
import { useAppContext } from '../context/AppContext';
import {
  WORKSPACE_EDIT,
  WORKSPACE_MEMBERS_ADD,
  WORKSPACE_MEMBERS_CHANGE_ROLE,
  canChangeWorkspaceMember,
  canWorkspace,
  type WorkspaceRole,
} from '../lib/permissions';
import { Button } from '../components/ui/button';
import { InfiniteScroll } from '../components/InfiniteScroll';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/input';
import { TextAreaInput } from '../components/ui/TextAreaInput';

const toEnglishDigits = (str: string) => str.trim();

const LIMIT = 10;

export default function EditWorkspace() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const isFa = lang === 'fa';

  const toPersianNum = (num: string | number | undefined | null) => {
    if (num === null || num === undefined) return num;
    if (!isFa) return num;
    return num.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d as any]);
  };

  const { user } = useAppContext();
  const currentUserId = user?.id || ''; 

  // Workspace Info States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<WorkspaceRole>('member');
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Members States
  const [members, setMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchedUser | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'member'>('member');

  // Pagination States
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberIdToDelete, setMemberIdToDelete] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [initialData, setInitialData] = useState({
    name: '',
    description: '',
  });

  const hasUnsavedChanges = useMemo(() => {
    if (isLoading) return false;

    const isNameChanged = name.trim() !== (initialData.name || '').trim();
    const isDescChanged = description.trim() !== (initialData.description || '').trim();
    const isImageChanged = !!thumbnailFile || clearThumbnail;

    return isNameChanged || isDescChanged || isImageChanged;
  }, [name, description, initialData, isLoading, thumbnailFile, clearThumbnail]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(thumbnailFile);
    setThumbnailPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnailFile]);

  const handleThumbnailChange = (file: File | null) => {
    if (!file) {
      setThumbnailFile(null);
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t.workspace?.thumbnailInvalidType || "Unsupported image type. Use JPG, PNG, or WebP.");
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(t.workspace?.thumbnailMaxSizeError || "Image size must be 2MB or less.");
      return;
    }
    setThumbnailFile(file);
    setClearThumbnail(false);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  useBlocker(({ currentLocation, nextLocation }) => {
    if (hasUnsavedChanges && !isSaving && currentLocation.pathname !== nextLocation.pathname) {
      return !window.confirm(t.confirmLeave || "You have unsaved changes. Are you sure you want to leave?");
    }
    return false;
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (!isLoading && id && !canWorkspace(myRole, WORKSPACE_EDIT)) {
      toast.error("You do not have permission to edit this workspace.");
      navigate(`/workspaces/${id}`);
    }
  }, [id, isLoading, myRole, navigate]);

  const reloadFirstPageMembers = async (bypassCache = false) => {
    const membersData = await fetchWorkspaceMemberships(
      { workspace: id!, limit: LIMIT, offset: 0 },
      { bypassCache }
    );
    const results = membersData.results || (Array.isArray(membersData) ? membersData : []);

    setMembers(results);
    setOffset(LIMIT);
    setHasMore(membersData.next ? true : results.length >= LIMIT);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const workspaceData = await getWorkspace(id!);
      setName(workspaceData.name);
      setDescription(workspaceData.description || '');
      setThumbnailUrl(workspaceData.thumbnail || null);
      setThumbnailFile(null);
      setClearThumbnail(false);
      setMyRole(workspaceData.my_role || 'member');
      setWorkspaceOwnerId(workspaceData.owner || '');

      await reloadFirstPageMembers();
      
      setInitialData({ 
        name: workspaceData.name, 
        description: workspaceData.description || '',
      });
    } catch (error) {
      toast.error(t.workspace?.toast?.errorLoad || "Failed to load workspace data.");
      navigate('/workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMembers = useCallback(async () => {
    if (isLoadingMembers || !hasMore || !id) return;
    try {
      setIsLoadingMembers(true);
      
      // Send as pure numbers, axios handles them cleanly
      const membersData = await fetchWorkspaceMemberships({ 
        workspace: id, 
        limit: LIMIT, 
        offset: offset 
      });
      const results = membersData.results || (Array.isArray(membersData) ? membersData : []);
      
      setMembers((prev) => {
        // Safe deduplication to avoid React key warnings
        const existingIds = new Set(prev.map(m => m.id));
        const newItems = results.filter((item: any) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      
      setOffset(offset + LIMIT);
      setHasMore(membersData.next ? true : results.length >= LIMIT);
      
    } catch (error) {
      console.error("Failed to load more members", error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [id, isLoadingMembers, hasMore, offset]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const cleanQuery = toEnglishDigits(searchQuery.trim());
    setSearchError(false);

    if (cleanQuery.length >= 10) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const user = await searchUserByExactMobile(cleanQuery);
          if (user && user.id) {
            setSearchResult(user);
            setSearchError(false);
          } else {
            setSearchResult(null);
            setSearchError(true);
          }
        } catch (error) {
          setSearchResult(null);
          setSearchError(true);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    } else {
      setSearchResult(null);
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !id) return;
    try {
      setIsSaving(true);
      const updatedWorkspace = await updateWorkspace(id, {
        name,
        description,
        thumbnail: thumbnailFile,
        clear_thumbnail: clearThumbnail,
      });
      toast.success(t.workspace?.toast?.successUpdate || "Workspace updated successfully.");
      window.dispatchEvent(new CustomEvent('workspace_edited', { 
        detail: updatedWorkspace
      }));
      navigate('/workspaces');
    } catch (error) {
      toast.error(getErrorMessage(error, t.workspace?.toast?.errorUpdate || "Failed to update workspace."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!searchResult || !id) return;
    try {
      await addWorkspaceMembership({
        workspace: id,
        user: String(searchResult.id),
        role: newMemberRole
      });
      await reloadFirstPageMembers(true);
      toast.success(t.workspace?.toast?.successAdd || "Member added successfully.");
      setSearchQuery('');
      setSearchResult(null);
      setNewMemberRole('member');
    } catch (error) {
      toast.error(getErrorMessage(error, t.workspace?.toast?.errorAdd || "Failed to add member."));
    }
  };

  const openDeleteModal = (membershipId: string) => {
    setMemberIdToDelete(membershipId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteMember = async () => {
    if (!memberIdToDelete) return;
    try {
      await removeWorkspaceMembership(memberIdToDelete);
      setMembers(members.filter(m => m.id !== memberIdToDelete));
      toast.success(t.workspace?.toast?.successRemove || "Member removed successfully.");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, t.workspace?.toast?.errorRemove || "Failed to remove member."));
    }
  };

  const handleChangeRole = async (membershipId: string, newRole: string) => {
    try {
      await updateWorkspaceMembership(membershipId, { role: newRole });
      setMembers(members.map(m => m.id === membershipId ? { ...m, role: newRole } : m));
      toast.success(t.workspace?.toast?.successRole || "Role updated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error, t.workspace?.toast?.errorRole || "Failed to update role."));
    }
  };

  const canManageMembers = canWorkspace(myRole, WORKSPACE_MEMBERS_CHANGE_ROLE);
  const isFirstOwner = currentUserId === workspaceOwnerId;
  const isOwner = myRole === "owner";

  const roleOptions = (allowOwnerRole: boolean, allowAdminRole: boolean) => [
    ...(allowOwnerRole ? [{ value: "owner", label: t.workspace?.roles?.owner || "Owner" }] : []),
    ...(allowAdminRole ? [{ value: "admin", label: t.workspace?.roles?.admin || "Admin" }] : []),
    { value: "member", label: t.workspace?.roles?.member || "Member" },
  ];

  if (isLoading) return <div className="p-8 text-center">{t.workspace?.loading || "Loading..."}</div>;

  return (
    <>
    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900 lg:overflow-hidden sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 shrink-0">
        {t.workspace?.editTitle || "Edit Workspace"}
      </h1>
      
      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row sm:gap-6">
        <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex lg:w-1/3 lg:max-w-md lg:flex-col lg:overflow-y-auto">
          <form onSubmit={handleSubmit} className="flex flex-col h-full p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.workspace?.nameLabel || "Name"}
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t.workspace?.descriptionLabel || "Description"}
              </label>
              <TextAreaInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.workspace?.descriptionPlaceholder || "Optional description..."}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 h-32 resize-none"
              />
            </div>
            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t.workspace?.thumbnailLabel || "Thumbnail"}
              </label>

              <label className="mt-3 flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-100 text-5xl font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt={name || "Workspace"}
                    className="h-full w-full object-cover"
                  />
                ) : !clearThumbnail && thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={name || "Workspace"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <UploadCloud className="h-10 w-10 text-slate-500 dark:text-slate-400" />

                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {t.workspace?.uploadImage || "Click to upload image"}
                      </span>
                  </div>
                )}

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                />
              </label>

              {(thumbnailUrl || thumbnailFile) && (
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailFile(null);
                    setClearThumbnail(true);
                  }}
                  className="mt-2 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  {t.workspace?.removeImage || "Remove image"}
                </button>
              )}
            </div>
            <div className="mt-auto pt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button type="button" variant="ghost" onClick={() => navigate('/workspaces')}>
                {t.actions?.cancel || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim()}>
                {isSaving ? (t.workspace?.loading || "Saving...") : (t.workspace?.save || "Save")}
              </Button>
            </div>
          </form>
        </div>

        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex lg:w-2/3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <div className="p-6 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                { t.workspace?.members || "Members" }
              </h2>
            </div>
{canWorkspace(myRole, WORKSPACE_MEMBERS_ADD) && (
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder={t.workspace?.searchMemberPlaceholder || "Search user by exact mobile number..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(toEnglishDigits(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  dir="auto"
                />
                
                {isSearching && <p className="text-sm text-slate-500">{t.workspace?.searching || "Searching..."}</p>}

                {searchError && !isSearching && (
                  <div className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20">
                    <AlertCircle className="w-4 h-4" />
                    {t.workspace?.userNotFound || "No user found with this exact number."}
                  </div>
                )}

                {searchResult && !isSearching && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 w-full">
                      {searchResult.profile_picture ? (
                        <img src={searchResult.profile_picture} alt={searchResult.first_name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm shadow-sm">
                          {searchResult.first_name?.[0] || "U"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {searchResult.first_name} {searchResult.last_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {toPersianNum(searchResult.mobile)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                      <Select
                        value={newMemberRole}
                        onChange={(val) => setNewMemberRole(val as any)}
                        options={[
                          ...roleOptions(isFirstOwner, isOwner),
                        ]}
                        className="flex-1 sm:flex-none"
                        buttonClassName="w-full sm:w-[110px] px-3 py-1.5 text-sm"
                      />
                      
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddMember}
                        disabled={members.some(m => m.user?.id === searchResult.id)}
                        className="gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" />
                        {members.some(m => m.user?.id === searchResult.id) 
                          ? (t.workspace?.userAlreadyAdded || "Added") 
                          : (t.workspace?.addMember || "Add")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 bg-slate-50/30 p-6 dark:bg-slate-900/30 lg:flex-1 lg:overflow-y-auto">
            <InfiniteScroll
              onLoadMore={loadMoreMembers}
              hasMore={hasMore}
              isLoading={isLoadingMembers}
              className="space-y-3"
              loader={<div className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">{t.workspace?.loading || "Loading more members..."}</div>}
            >
              {members.map((m) => {
                const isThisMemberTheFirstOwner = m.user?.id === workspaceOwnerId;
                const canChangeThisUserRole = canChangeWorkspaceMember({
                  actorRole: myRole,
                  actorUserId: currentUserId,
                  targetRole: m.role,
                  targetUserId: m.user?.id,
                  ownerUserId: workspaceOwnerId,
                });

                return (
                  <div key={m.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                      {m.user?.profile_picture ? (
                        <img src={m.user?.profile_picture} alt={m.user?.first_name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-sm shadow-sm">
                          {m.user?.name?.[0] || m.user?.first_name?.[0] || "U"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {m.user?.name || `${m.user?.first_name || ''} ${m.user?.last_name || ''}`.trim() || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500">{toPersianNum(m.user?.mobile)}</p>
                      </div>
                    </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        {canChangeThisUserRole ? (
                          <Select
                            value={m.role}
                            onChange={(val) => handleChangeRole(m.id, val)}
                            options={roleOptions(isFirstOwner, isOwner)}
                            buttonClassName="w-[110px] px-3 py-1.5 text-sm"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md capitalize flex items-center gap-1">
                            {m.role === 'owner' && <Shield className="w-3 h-3" />}
                            {m.role && m.role in t.workspace.roles
                              ? t.workspace.roles[m.role as keyof typeof t.workspace.roles]
                              : m.role || "-"}
                          </span>
                        )}

                        {canChangeThisUserRole && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(m.id)}
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            title={t.workspace?.removeMemberTitle || "Remove member"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </InfiniteScroll>
            {members.length === 0 && !isLoadingMembers && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                <Shield className="w-12 h-12 mb-3 text-slate-200 dark:text-slate-700" />
                <p className="text-sm">
                  {t.workspace?.noMembers || "No members found."}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      <Transition appear show={isDeleteDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteDialogOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl transition-all border border-slate-200 dark:border-slate-800">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t.workspace?.confirmDeleteTitle || "Remove Member"}
                  </Dialog.Title>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.workspace?.confirmDeleteMessage || "Are you sure you want to remove this member from the workspace?"}
                  </p>
                  <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setIsDeleteDialogOpen(false)}>
                      {t.actions?.cancel || "Cancel"}
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteMember}>
                      {t.actions?.delete || "Delete"}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
    </>
  );
}
