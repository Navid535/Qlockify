import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Edit2,
  FolderKanban,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';

import { getClients } from '../api/clients';
import { getProjects } from '../api/projects';
import { getTags } from '../api/tags';
import {
  deleteWorkspace,
  fetchWorkspaceMemberships,
  getWorkspace,
  type Workspace,
  type WorkspaceMembership,
} from '../api/workspaces';
import { useAppContext } from '../context/AppContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useTranslation } from '../hooks/useTranslation';
import {
  CLIENTS_VIEW,
  PROJECTS_VIEW,
  TAGS_VIEW,
  WORKSPACE_DELETE,
  WORKSPACE_EDIT,
  WORKSPACE_MEMBERS_VIEW,
  WORKSPACE_VIEW,
  canWorkspace,
} from '../lib/permissions';

type ResourceCounts = {
  projects: number;
  clients: number;
  tags: number;
};

const roleBadgeStyles: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  guest: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { user } = useAppContext();
  const { setActiveWorkspace } = useWorkspace();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMembership[]>([]);
  const [counts, setCounts] = useState<ResourceCounts>({ projects: 0, clients: 0, tags: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const isRtl = lang === 'fa';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!id) return;
    void loadWorkspace();
  }, [id]);

  const loadWorkspace = async () => {
    try {
      const data = await getWorkspace(id!);
      setWorkspace(data);

      const canViewMembers = canWorkspace(data.my_role, WORKSPACE_VIEW);
      const canViewClients = canWorkspace(data.my_role, CLIENTS_VIEW);
      const canViewProjects = canWorkspace(data.my_role, PROJECTS_VIEW);
      const canViewTags = canWorkspace(data.my_role, TAGS_VIEW);

      const tasks: Promise<void>[] = [];

      if (canViewMembers) {
        tasks.push(
          fetchWorkspaceMemberships({ workspace: id!, limit: 200, offset: 0 }).then((response) => {
            setMembers(response.results || []);
          }),
        );
      } else {
        setMembers([]);
      }

      tasks.push(
        Promise.all([
          canViewProjects ? getProjects(id!, { limit: 1, offset: 0, is_archived: false }) : Promise.resolve({ count: 0 }),
          canViewClients ? getClients(id!, '', '', 1, 0) : Promise.resolve({ count: 0 }),
          canViewTags ? getTags(id!, { limit: 1, offset: 0 }) : Promise.resolve({ count: 0, results: [] }),
        ]).then(([projectsData, clientsData, tagsData]) => {
          setCounts({
            projects: projectsData.count || 0,
            clients: clientsData.count || 0,
            tags: tagsData.count || 0,
          });
        }),
      );

      await Promise.all(tasks);
    } catch (error) {
      console.error(error);
      navigate('/workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t.workspace?.confirmDelete) || !id) return;
    try {
      await deleteWorkspace(id);
      navigate('/workspaces');
    } catch (error) {
      console.error(error);
    }
  };

  const activeMembers = members.filter((member) => member.is_active);
  const roleCounts = useMemo(
    () =>
      activeMembers.reduce(
        (acc, member) => {
          acc[member.role] += 1;
          return acc;
        },
        { owner: 0, admin: 0, member: 0, guest: 0 },
      ),
    [activeMembers],
  );

  const displayNumber = (value: number) =>
    new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(value);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const getMemberName = (member: WorkspaceMembership) => {
    const firstName = member.user?.first_name?.trim() || '';
    const lastName = member.user?.last_name?.trim() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || member.user?.email || t.workspace?.unknownMember || 'Unknown member';
  };

  const getMemberContact = (member: WorkspaceMembership) => {
    return member.user?.mobile || member.user?.email || '-';
  };

  const getMemberInitials = (member: WorkspaceMembership) => {
    const firstName = member.user?.first_name?.trim()?.charAt(0) || '';
    const lastName = member.user?.last_name?.trim()?.charAt(0) || '';
    return `${firstName}${lastName}`.trim().toUpperCase() || getMemberName(member).charAt(0).toUpperCase();
  };

  const workspaceRole = workspace?.my_role;
  const canEdit = canWorkspace(workspaceRole, WORKSPACE_EDIT);
  const canDelete = canWorkspace(workspaceRole, WORKSPACE_DELETE);
  const canViewMembers = canWorkspace(workspaceRole, WORKSPACE_VIEW);
  const canViewMemberSensitiveDetails = canWorkspace(workspaceRole, WORKSPACE_MEMBERS_VIEW);

  if (isLoading || !workspace) {
    return <div className="p-8 text-center">{t.workspace?.loading}</div>;
  }

  const openWorkspaceRoute = (path: string) => {
    setActiveWorkspace(workspace);
    navigate(path);
  };

  const resourceCards = [
    {
      key: 'projects',
      title: t.sidebar?.projects || 'Projects',
      value: displayNumber(counts.projects),
      icon: FolderKanban,
      onClick: () => openWorkspaceRoute('/projects'),
      visible: canWorkspace(workspace.my_role, PROJECTS_VIEW),
    },
    {
      key: 'clients',
      title: t.sidebar?.clients || 'Clients',
      value: displayNumber(counts.clients),
      icon: BriefcaseBusiness,
      onClick: () => openWorkspaceRoute('/clients'),
      visible: canWorkspace(workspace.my_role, CLIENTS_VIEW),
    },
    {
      key: 'tags',
      title: t.sidebar?.tags || 'Tags',
      value: displayNumber(counts.tags),
      icon: Tag,
      onClick: () => openWorkspaceRoute('/tags'),
      visible: canWorkspace(workspace.my_role, TAGS_VIEW),
    },
  ].filter((item) => item.visible);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <button
        onClick={() => navigate('/workspaces')}
        className="flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white"
      >
        <BackIcon className="h-5 w-5" />
        <span>{t.workspace?.back}</span>
      </button>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 w-full">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {workspace.name}
              </h1>
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${roleBadgeStyles[workspace.my_role || 'guest']}`}>
                {workspace.my_role ? t.workspace?.roles[workspace.my_role] : '-'}
              </span>
            </div>
            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-400">
              {workspace.description || t.workspace?.noDescription}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.workspace?.statsMembers || 'Members'}</span>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{displayNumber(activeMembers.length)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.workspace?.statsOwnersAdmins || 'Owners & admins'}</span>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {displayNumber(roleCounts.owner + roleCounts.admin)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.workspace?.statsGuests || 'Guests'}</span>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{displayNumber(roleCounts.guest)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          {t.workspace?.resourcesTitle || 'Resources'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resourceCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                onClick={card.onClick}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-start transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{card.value}</p>
                  </div>
                </div>
                <BackIcon className="h-4 w-4 rtl:rotate-180 text-slate-400" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t.workspace?.membersSectionTitle || t.workspace?.members || 'Members'}
              </h2>
              {canViewMembers
                  ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      { t.workspace?.membersSectionSubtitle || 'People in this workspace and their current roles.' }
                    </p>
                  : ''}
            </div>
            {canEdit && (
              <button
                onClick={() => navigate(`/workspaces/${id}/edit`)}
                className="inline-flex gap-2 h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
              >
                {t.workspace?.manageMembers || 'Manage members'}
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {canViewMembers ? (
          <div className={`divide-y divide-slate-100 dark:divide-slate-800 ${activeMembers.length > 6 ? 'max-h-[36rem] overflow-y-auto' : ''}`}>
            {activeMembers.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                {t.workspace?.noMembers || 'No members found.'}
              </div>
            ) : (
              activeMembers.map((member) => {
                const isCurrentUser = member.user.id === user?.id;
                return (
                  <div
                    key={member.id}
                    className={`flex flex-col gap-4 p-5 sm:p-6 ${
                      isCurrentUser
                        ? 'bg-blue-50/80 ring-1 ring-blue-200 dark:bg-blue-950/20 dark:ring-blue-900/60'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                            {member.user?.profile_picture ? (
                              <img
                                src={member.user.profile_picture}
                                alt={getMemberName(member)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{getMemberInitials(member)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                            {getMemberName(member)}
                          </h3>
                          {isCurrentUser && (
                            <span className="inline-flex rounded-full border border-blue-200 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-300">
                              {t.workspace?.youLabel || 'You'}
                            </span>
                          )}
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeStyles[member.role]}`}>
                            {t.workspace?.roles[member.role]}
                          </span>
                        </div>
                        {canViewMemberSensitiveDetails && (
                          <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                            <p>
                              {t.workspace?.mobileNumber || 'Mobile Number'}: {getMemberContact(member)}
                            </p>
                          </div>
                        )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            {t.workspace?.membersLocked || 'This member list is not available for your current role.'}
          </div>
        )}
      </section>
    </div>
  );
}
