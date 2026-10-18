import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { AlertCircle, UserPlus, Trash2, Shield, Loader2, UploadCloud } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'sonner';
import { createWorkspace } from '../api/workspaces';
import { getErrorMessage } from '../api/client';
import { searchUserByExactMobile, type SearchedUser } from '../api/users';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/Select';
import { TextAreaInput } from '../components/ui/TextAreaInput';

const toEnglishDigits = (str: string) => str.trim();

interface LocalMember {
  localId: string;
  user: SearchedUser;
  role: 'owner' | 'admin' | 'member';
}

export default function WorkspaceCreate() {
  const navigate = useNavigate();
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
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Members States (Local)
  const [members, setMembers] = useState<LocalMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchedUser | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'member'>('member');

  // Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberIdToDelete, setMemberIdToDelete] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedChanges = name.trim() !== '' || description.trim() !== '' || members.length > 0 || !!thumbnailFile;

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
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const cleanQuery = toEnglishDigits(searchQuery.trim());
    setSearchError(false);

    if (cleanQuery.length >= 10) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const user = await searchUserByExactMobile(cleanQuery);
          if (user && user.id) {
            // Prevent finding self
            if (user.id === currentUserId) {
              setSearchResult(null);
              setSearchError(true);
              toast.error(t.workspace?.toast?.cannotAddSelf || "You are automatically the owner.");
            } else {
              setSearchResult(user);
              setSearchError(false);
            }
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
  }, [searchQuery, currentUserId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setIsSaving(true);
      
      const payload = {
        name,
        description,
        members: members.map(m => ({ user_id: m.user.id, role: m.role })),
        thumbnail: thumbnailFile,
      };
      const newWorkspace = await createWorkspace(payload);

      window.dispatchEvent(new CustomEvent('workspace_created', {
        detail: newWorkspace
      }));
      toast.success(t.workspace?.toast?.successCreate || "Workspace created successfully.");
      
      navigate('/workspaces');
    } catch (error) {
      toast.error(getErrorMessage(error, t.workspace?.toast?.errorCreate || "Failed to create workspace."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = () => {
    if (!searchResult) return;
    
    if (members.some(m => m.user.id === searchResult.id)) {
      toast.error(t.workspace?.userAlreadyAdded || "User already added.");
      return;
    }

    const newMember: LocalMember = {
      localId: Math.random().toString(36).substr(2, 9),
      user: searchResult,
      role: newMemberRole
    };

    setMembers([...members, newMember]);
    setSearchQuery('');
    setSearchResult(null);
    setNewMemberRole('member');
  };

  const openDeleteModal = (localId: string) => {
    setMemberIdToDelete(localId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteMember = () => {
    if (!memberIdToDelete) return;
    setMembers(members.filter(m => m.localId !== memberIdToDelete));
    setIsDeleteDialogOpen(false);
    setMemberIdToDelete(null);
  };

  const handleChangeRole = (localId: string, newRole: string) => {
    setMembers(members.map(m => m.localId === localId ? { ...m, role: newRole as any } : m));
  };

  const canManageMembers = true;
  const isFirstOwner = true;

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900 lg:overflow-hidden sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 shrink-0">
        {t.workspace?.createTitle || "Create Workspace"}
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
                placeholder={t.workspace?.namePlaceholder || "e.g. My Company"}
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
    ) : (
      <div className="flex flex-col items-center gap-2 text-center">
        <UploadCloud className="h-12 w-12 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t.workspace?.uploadImage || "Click to upload image"}
          </span>
      </div>
    )}

    <Input
      type="file"
      accept=".jpg,.jpeg,.png,.webp"
      className="hidden"
      onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
    />
  </label>

  {thumbnailFile && (
    <button
      type="button"
      onClick={() => setThumbnailFile(null)}
      className="mt-2 text-xs text-red-600 hover:underline dark:text-red-400"
    >
      {t.workspace?.removeImage || "Remove image"}
      </button>
    )}
  </div>
            <div className="mt-auto pt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/workspaces')}
              >
                {t.actions?.cancel || "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? (t.workspace?.loading || "Saving...") : (t.workspace?.create || "Create")}
              </Button>
            </div>
          </form>
        </div>

        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex lg:w-2/3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          <div className="p-6 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              { t.workspace?.members || "Members" }
            </h2>
            
            {canManageMembers && (
              <div className="space-y-3">
                <div className="relative w-full">
                  {isSearching && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-auto right-3 pointer-events-none">
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    </div>
                  )}
                  <Input
                    type="tel"
                    placeholder={t.workspace?.searchMemberPlaceholder || "Search user by exact mobile number..."}
                    value={searchQuery}
                    onChange={(e) => {
                      const englishDigits = toEnglishDigits(e.target.value);
                      if (/\D/.test(englishDigits)) {
                        toast.warning(t.workspace?.onlyNumbersAllowed || "Only numbers are allowed.");
                      }
                      const numbersOnly = englishDigits.replace(/\D/g, '');
                      setSearchQuery(numbersOnly);
                    }}
                    className="w-full px-4 pe-10 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    
                  />
                </div>
                
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
                          ...(isFirstOwner ? [{ value: "owner", label: t.workspace?.roles?.owner || "Owner" }] : []),
                          { value: "admin", label: t.workspace?.roles?.admin || "Admin" },
                          { value: "member", label: t.workspace?.roles?.member || "Member" },
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
            {members.map((m) => {
              return (
                <div key={m.localId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg gap-3 shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div className="flex items-center gap-3">
                    {m.user?.profile_picture ? (
                      <img src={m.user?.profile_picture} alt={m.user?.first_name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-sm shadow-sm">
                        {m.user?.first_name?.[0] || m.user?.last_name?.[0] || "U"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {`${m.user?.first_name || ''} ${m.user?.last_name || ''}`.trim() || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">{toPersianNum(m.user?.mobile)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <Select
                      value={m.role}
                      onChange={(val) => handleChangeRole(m.localId, val)}
                      options={[
                        ...(isFirstOwner ? [{ value: "owner", label: t.workspace?.roles?.owner || "Owner" }] : []),
                        { value: "admin", label: t.workspace?.roles?.admin || "Admin" },
                        { value: "member", label: t.workspace?.roles?.member || "Member" },
                      ]}
                      buttonClassName="w-[110px] px-3 py-1.5 text-sm"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteModal(m.localId)}
                      className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      title={t.workspace?.removeMemberTitle || "Remove member"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                <Shield className="w-12 h-12 mb-3 text-slate-200 dark:text-slate-700" />
                <p className="text-sm">
                  {t.workspace?.noMembers || "No members added yet."}
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
                    <Button
                      variant="secondary"
                      onClick={() => setIsDeleteDialogOpen(false)}
                    >
                      {t.actions?.cancel || "Cancel"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteMember}
                    >
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
  );
}
