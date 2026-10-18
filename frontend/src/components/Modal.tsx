import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  isFa?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  description,
  footer,
  maxWidth = "max-w-lg",
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card 
        className={`flex max-h-[calc(100vh-2rem)] w-full flex-col ${maxWidth} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-0 shadow-xl overflow-hidden rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-5">
          {description && (
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{description}</p>
          )}
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {footer}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
