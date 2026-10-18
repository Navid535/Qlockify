import { useState } from "react";
import { toast } from "sonner";
import { type Client } from "../types/client";
import { deleteClient } from "../api/clients";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "./ui/button";
import { Modal } from "./Modal";

interface DeleteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client | null;
}

export default function DeleteClientModal({ isOpen, onClose, onSuccess, client }: DeleteClientModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      await deleteClient(client.id);
      toast.success(t.clients.deleteSuccess);
      onSuccess();
      onClose();
    } catch (error) {
      console.error(t.clients.errors.deleteFailed, error);
      toast.error(t.clients.errors.deleteFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isLoading}>
        {t.actions?.cancel}
      </Button>
      <Button 
        variant="destructive"
        onClick={handleDelete} 
        disabled={isLoading}
      >
        {isLoading ? "..." : t.clients.delete}
      </Button>
    </>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={t.clients.deleteConfirmTitle} 
      footer={footer}
      maxWidth="max-w-sm"
    >
      <p className="text-slate-500 dark:text-slate-400">
        {client ? t.clients.deleteConfirmMessage(client.name) : ""}
      </p>
    </Modal>
  );
}
