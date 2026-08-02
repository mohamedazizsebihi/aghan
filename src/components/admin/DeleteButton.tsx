"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeleteButton({
  url,
  confirmMessage,
  onDeleted,
  className,
  label,
}: {
  url: string;
  confirmMessage: string;
  onDeleted?: () => void;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Deleted successfully");
      onDeleted?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      aria-label={label ? undefined : "Delete"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full p-2 text-burgundy-700 transition-colors hover:bg-burgundy-700/10 hover:text-burgundy-800 disabled:opacity-50",
        className
      )}
    >
      <Trash2 className="h-4 w-4" />
      {label}
    </button>
  );
}
