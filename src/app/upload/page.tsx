"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload as UploadIcon, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";

export default function UploadPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;

    setUploading(true);
    setError("");

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/books/upload", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: title.trim(), author: author.trim() || undefined, text }),
      });
      const data = await res.json();

      if (data.success) {
        router.push(`/book/${data.data.bookId}`);
      } else {
        setError(data.error?.message ?? "Upload failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const charCount = text.length;
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const estimatedChunks = Math.ceil(charCount / 2000);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Upload Book</h1>
        <p className="text-muted-foreground mt-1">
          Upload a book&apos;s full text to begin AI cognitive analysis
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Book Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Meditations"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Marcus Aurelius"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Full Text * <span className="text-muted-foreground font-normal">(min 100 characters)</span>
              </label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the complete book text here…"
                className="min-h-[300px] resize-y font-mono text-sm"
                required
              />
              {text && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{charCount.toLocaleString()} chars</Badge>
                  <Badge variant="secondary">{wordCount.toLocaleString()} words</Badge>
                  <Badge variant="secondary">~{estimatedChunks} chunks</Badge>
                </div>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
            )}

            <Button type="submit" disabled={uploading || !title.trim() || text.length < 100} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading…
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Upload &amp; Analyze
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
