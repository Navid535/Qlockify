import React, { useState, useEffect } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { Modal } from "../Modal";
import { updateProject, toggleArchiveProject } from "../../api/projects";
import { getErrorMessage } from "../../api/client";
import { getClients } from "../../api/clients";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Archive, RefreshCcw } from "lucide-react";
import { Select } from "../ui/Select";
import { Input } from "../ui/input";
import { TextAreaInput } from "../ui/TextAreaInput";
import { toast } from "sonner";
import { PROJECTS_ARCHIVE, PROJECTS_EDIT, canWorkspace } from "../../lib/permissions";

interface ProjectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
}

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({ isOpen, onClose, project }) => {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const canEditProject = canWorkspace(activeWorkspace?.my_role, PROJECTS_EDIT);
  const canArchiveProject = canWorkspace(activeWorkspace?.my_role, PROJECTS_ARCHIVE);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    client: "",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    if (isOpen && activeWorkspace) {
      setLoadingClients(true);
      getClients(activeWorkspace.id)
        .then((res: any) => setClients(res.results || res))
        .catch((err) => toast.error(t.projects?.clientFetchError || err.message || "Failed to load clients"))
        .finally(() => setLoadingClients(false));
    }
  }, [isOpen, activeWorkspace]);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        color: project.color || "#3B82F6",
        client: project.client ? project.client.id : "",
      });
      setThumbnailUrl(project.thumbnail || null);
      setThumbnailFile(null);
      setClearThumbnail(false);
    }
  }, [project]);

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
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(t.workspace?.thumbnailInvalidType || "Unsupported image type. Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.workspace?.thumbnailMaxSizeError || "Image size must be 2MB or less.");
      return;
    }
    setThumbnailFile(file);
    setClearThumbnail(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!project || !formData.name) return;

    setLoading(true);
    try {
      const updated = await updateProject(project.id, {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        client: formData.client || null,
        thumbnail: thumbnailFile,
        clear_thumbnail: clearThumbnail,
      });

      toast.success(t.projects?.updateSuccess || "Project updated successfully.");
      window.dispatchEvent(new CustomEvent("project_updated", { detail: updated }));
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, t.projects?.updateError || "Failed to update project."));
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const updated = await toggleArchiveProject(project.id, Boolean(project?.is_archived));
      toast.success(
        project?.is_archived
          ? t.projects?.restoreSuccess || t.projects?.updateSuccess || "Project updated successfully."
          : t.projects?.archiveSuccess || t.projects?.updateSuccess || "Project updated successfully.",
      );
      window.dispatchEvent(new CustomEvent("project_updated", { detail: updated }));
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, t.projects?.updateError || "Failed to update project."));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-between w-full">
      {canArchiveProject ? (
        <button
          onClick={handleArchiveToggle}
          type="button"
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border ${
            project?.is_archived 
              ? "text-green-600 border-green-600 hover:bg-green-50" 
              : "text-amber-600 border-amber-600 hover:bg-amber-50"
          }`}
        >
          {project?.is_archived ? <RefreshCcw size={16} /> : <Archive size={16} />}
          {project?.is_archived ? t.projects.restore : t.projects.archive}
        </button>
      ) : (
        <div />
      )}
      
      <div className="flex gap-2">
        <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600">
          {t.actions?.cancel || "Cancel"}
        </button>
        <button onClick={handleSubmit} disabled={loading || !formData.name} type="button" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? "..." : t.save || "Save"}
        </button>
      </div>
    </div>
  );

  if (!canEditProject) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.projects.editProject} footer={footer}>
      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              {t.projects.titleLabel}
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              placeholder={t.projects?.titlePlaceholder}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex flex-col items-center shrink-0">
            <div className="mb-1 text-sm font-medium invisible">C</div>
            <div 
              className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600 shadow-sm cursor-pointer shrink-0"
              title={t.projects.colorLabel}
            >
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t.workspace?.thumbnailLabel || "Thumbnail"}
          </label>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold text-white" style={{ backgroundColor: formData.color || "#3B82F6" }}>
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="" className="h-full w-full object-cover" />
              ) : !clearThumbnail && thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                formData.name.trim().charAt(0).toUpperCase() || "P"
              )}
            </div>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleThumbnailChange(event.target.files?.[0] || null)} />
            {(thumbnailFile || (!clearThumbnail && thumbnailUrl)) ? (
              <button
                type="button"
                onClick={() => {
                  setThumbnailFile(null);
                  setClearThumbnail(true);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              >
                {t.remove || "Remove"}
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t.projects?.descriptionLabel || 'Description'}
          </label>
          <TextAreaInput
            value={formData.description}
            placeholder={t.projects?.titlePlaceholder}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:text-slate-100 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t.projects.clientLabel}
          </label>
          <Select
            value={formData.client}
            onChange={(val) => setFormData({ ...formData, client: val })}
            options={[
              { value: "", label: t.projects.noClient },
              ...clients.map(c => ({ value: c.id, label: c.name }))
            ]}
            isLoading={loadingClients}
            className="w-full"
            buttonClassName="w-full"
          />
        </div>
      </form>
    </Modal>
  );
};
