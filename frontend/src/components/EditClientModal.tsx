import { useState, useEffect } from "react";
import { toast } from "sonner";
import { type Client } from "../types/client";
import { updateClient } from "../api/clients";
import { getErrorMessage } from "../api/client";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./Modal";
import { TextAreaInput } from "./ui/TextAreaInput";

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client | null;
}

export default function EditClientModal({ isOpen, onClose, onSuccess, client }: EditClientModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setNotes(client.notes || "");
      setThumbnailUrl(client.thumbnail || null);
      setThumbnailFile(null);
      setClearThumbnail(false);
    }
  }, [client]);

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

  const handleSubmit = async () => {
    if (!client || !name.trim()) return;
    setIsLoading(true);
    try {
      await updateClient(client.id, { name, notes, thumbnail: thumbnailFile, clear_thumbnail: clearThumbnail });
      toast.success(t.clients.updateSuccess);
      onSuccess();
      onClose();
    } catch (error) {
      console.error(t.clients.errors.updateFailed, error);
      toast.error(getErrorMessage(error, t.clients.errors.updateFailed));
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isLoading}>
        {t.actions?.cancel}
      </Button>
      <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
        {isLoading ? "..." : t.clients.saveChanges}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.clients.editClient} footer={footer}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
            {t.workspace?.thumbnailLabel || "Thumbnail"}
          </label>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="" className="h-full w-full object-cover" />
              ) : !clearThumbnail && thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                name.trim().charAt(0).toUpperCase() || "C"
              )}
            </div>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleThumbnailChange(event.target.files?.[0] || null)} />
            {(thumbnailFile || (!clearThumbnail && thumbnailUrl)) ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setThumbnailFile(null);
                  setClearThumbnail(true);
                }}
              >
                {t.remove || "Remove"}
              </Button>
            ) : null}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
            {t.clients.clientName}
          </label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder={t.clients.clientNamePlaceholder}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
            {t.clients.notes}
          </label>
          <TextAreaInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.clients.notesPlaceholder}
          />
        </div>
      </div>
    </Modal>
  );
}
