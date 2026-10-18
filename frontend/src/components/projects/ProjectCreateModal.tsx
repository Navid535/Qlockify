import React, { useState, useEffect } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { Modal } from "../Modal";
import { createProject } from "../../api/projects";
import { getErrorMessage } from "../../api/client";
import { getClients } from "../../api/clients";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Select } from "../ui/Select";
import { Input } from "../ui/input";
import { TextAreaInput } from "../ui/TextAreaInput";
import { toast } from "sonner";
import { PROJECTS_CREATE, canWorkspace } from "../../lib/permissions";

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const canCreateProject = canWorkspace(activeWorkspace?.my_role, PROJECTS_CREATE);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    client: "",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);

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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(t.workspace?.thumbnailInvalidType || "Unsupported image type. Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.workspace?.thumbnailMaxSizeError || "Image size must be 2MB or less.");
      return;
    }
    setThumbnailFile(file);
  };

  useEffect(() => {
    if (isOpen && activeWorkspace) {
      setLoadingClients(true);
      getClients(activeWorkspace.id)
        .then((res: any) => setClients(res.results || res))
        .catch((err) => toast.error(t.projects?.clientFetchError || err.message || "Failed to load clients"))
        .finally(() => setLoadingClients(false));
    }
  }, [isOpen, activeWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !formData.name) return;

    setLoading(true);
    try {
      const newProject = await createProject({
        workspace: activeWorkspace.id,
        name: formData.name,
        description: formData.description,
        color: formData.color,
        client: formData.client || null,
        thumbnail: thumbnailFile,
      });

      toast.success(t.projects?.createSuccess || "Project created successfully.");
      window.dispatchEvent(new CustomEvent("project_created", { detail: newProject }));
      onClose();
      setFormData({ name: "", description: "", color: "#3B82F6", client: "" });
      setThumbnailFile(null);
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, t.projects?.createError || "Failed to create project."));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700">
        {t.actions?.cancel || "Cancel"}
      </button>
      <button onClick={handleSubmit} disabled={loading || !formData.name} type="button" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {loading ? "..." : t.projects?.create}
      </button>
    </>
  );

  if (!canCreateProject) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.projects?.createProject} footer={footer}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
              {thumbnailPreview ? <img src={thumbnailPreview} alt="" className="h-full w-full object-cover" /> : formData.name.trim().charAt(0).toUpperCase() || "P"}
            </div>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleThumbnailChange(event.target.files?.[0] || null)} />
            {thumbnailFile ? (
              <button type="button" onClick={() => setThumbnailFile(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">
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
