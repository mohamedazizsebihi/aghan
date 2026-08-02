"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { getCategoryIcon } from "@/lib/category-icons";

export function CategoryImageUploader({
  categoryId,
  categorySlug,
  imageUrl,
}: {
  categoryId: string;
  categorySlug: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(imageUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/categories/${categoryId}/image`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPreview(data.category.imageUrl);
      toast.success("Category photo updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-ink/10">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={preview ? "Replace category photo" : "Add category photo"}
        className="absolute inset-0 disabled:opacity-50"
      >
        {preview ? (
          <Image src={preview} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <PatternPlaceholder icon={getCategoryIcon(categorySlug)} />
        )}
        {/* Always-on affordance (not hover-gated) so the edit action is
            discoverable on touch devices, not just desktop. */}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-ink/60 py-0.5">
          {uploading ? (
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />
          ) : (
            <Upload className="h-2.5 w-2.5 text-cream" />
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
