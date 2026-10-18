import type { LucideIcon } from "lucide-react";

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export default function EmptyStateCard({
  icon: Icon,
  title,
  description,
  className = "",
}: EmptyStateCardProps) {
  return (
    <div
      className={`flex flex-1 flex-col justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <Icon className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-700" />
      <h3 className="text-lg font-medium text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
