"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";

export function ImageUploader({
  dishId,
  imageUrl,
}: {
  dishId: string;
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
      const res = await fetch(`/api/dishes/${dishId}/image`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPreview(data.dish.imageUrl);
      toast.success("Photo updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-xl ring-1 ring-ink/10">
        {preview ? (
          <Image
            src={preview}
            alt="Dish photo"
            fill
            sizes="(min-width: 640px) 384px, 100vw"
            className="object-cover"
          />
        ) : (
          <PatternPlaceholder />
        )}
      </div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-ink/30 disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : preview ? "Replace Photo" : "Upload Photo"}
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
