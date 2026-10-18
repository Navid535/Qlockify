import { useEffect, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getClients } from "../api/clients";
import { getProject, updateProject } from "../api/projects";
import { getErrorMessage } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/Select";
import { TextAreaInput } from "../components/ui/TextAreaInput";
import { useWorkspace } from "../context/WorkspaceContext";
import { useTranslation } from "../hooks/useTranslation";
import { PROJECTS_EDIT, canWorkspace } from "../lib/permissions";

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

export default function ProjectEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const canEditProject = canWorkspace(activeWorkspace?.my_role, PROJECTS_EDIT);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [client, setClient] = useState("");
  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges = name.trim() !== "";

  useEffect(() => {
    if (activeWorkspace && !canEditProject) {
      toast.error("You do not have permission to edit projects.");
      navigate("/projects");
    }
  }, [activeWorkspace, canEditProject, navigate]);

  useBlocker(({ currentLocation, nextLocation }) => {
    if (hasUnsavedChanges && !isSaving && !isProjectLoading && currentLocation.pathname !== nextLocation.pathname) {
      return !window.confirm(t.confirmLeave || "You have unsaved changes. Are you sure you want to leave?");
    }
    return false;
  });

  useEffect(() => {
    if (!activeWorkspace?.id || !id) return;

    const loadInitialData = async () => {
      try {
        const [clientsRes, projectRes] = await Promise.all([
          getClients(activeWorkspace.id),
          getProject(id),
        ]);

        setClientsList(clientsRes.results || []);
        setName(projectRes.name || "");
        setDescription(projectRes.description || "");
        setColor(projectRes.color || COLORS[0]);
        setClient(projectRes.client?.id || projectRes.client || "");
      } catch {
        toast.error("Failed to load project data.");
        navigate("/projects");
      } finally {
        setIsLoadingData(false);
        setIsProjectLoading(false);
      }
    };

    void loadInitialData();
  }, [activeWorkspace?.id, id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspace || !id) return;

    try {
      setIsSaving(true);
      const updatedProject = await updateProject(id, {
        name,
        description,
        color,
        client: client || null,
      });

      window.dispatchEvent(new CustomEvent("project_updated", { detail: updatedProject }));
      toast.success(t.projects?.updateSuccess || "Project updated successfully.");
      navigate("/projects");
    } catch (error: any) {
      toast.error(getErrorMessage(error, t.projects?.updateError || "Failed to update project."));
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeWorkspace) return null;

  if (isProjectLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-200">
          {t.projects?.edit || "Edit Project"}
        </h1>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 shrink-0 rounded-lg shadow-sm" style={{ backgroundColor: color }} />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.projects?.namePlaceholder || "Project name..."}
                  required
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLORS.map((paletteColor) => (
                  <button
                    key={paletteColor}
                    type="button"
                    onClick={() => setColor(paletteColor)}
                    className={`h-5 w-5 shrink-0 rounded-full transition-all duration-150 ${
                      color === paletteColor
                        ? "scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-white shadow-md dark:ring-offset-slate-900"
                        : "shadow-sm hover:scale-110"
                    }`}
                    style={{ backgroundColor: paletteColor }}
                    aria-label={`Select color ${paletteColor}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Briefcase size={16} />
                {t.projects?.client || "Client"}
              </label>
              <Select
                value={client}
                onChange={setClient}
                options={[
                  { value: "", label: t.projects?.noClient || "No Client" },
                  ...clientsList.map((item) => ({ value: item.id, label: item.name })),
                ]}
                isLoading={isLoadingData}
                className="w-full"
                buttonClassName="w-full"
              />
            </div>

            <div>
              <label className="mb-2 block text-slate-700 dark:text-slate-300">
                {t.projects?.descriptionLabel || "Description"}
              </label>
              <TextAreaInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.projects?.descriptionPlaceholder || "Add more details..."}
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Button variant="ghost" type="button" onClick={() => navigate("/projects")}>
                {t.cancel || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim()}>
                {isSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t.save || "Save"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
