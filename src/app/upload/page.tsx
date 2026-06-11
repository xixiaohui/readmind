"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload as UploadIcon, FileText, Loader2, ChevronRight,
  CheckCircle, Clock, AlertCircle, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";

interface BookItem {
  id: string;
  title: string;
  author: string | null;
  status: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  workflow: { status: string; progress: number } | null;
}

const statusBadge = (book: BookItem) => {
  const ws = book.workflow?.status;
  if (ws === "completed" || book.status === "completed") {
    return <Badge className="bg-emerald-400/10 text-emerald-400 text-xs"><CheckCircle className="h-3 w-3 mr-1" />已分析</Badge>;
  }
  if (ws === "running" || ws === "pending") {
    return <Badge className="bg-blue-400/10 text-blue-400 text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />分析中</Badge>;
  }
  if (ws === "failed" || book.status === "failed") {
    return <Badge className="bg-red-400/10 text-red-400 text-xs"><AlertCircle className="h-3 w-3 mr-1" />失败</Badge>;
  }
  return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />待处理</Badge>;
};

export default function UploadPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  useEffect(() => {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/library", { headers })
      .then((r) => r.json())
      .then((d) => setBooks(d.data?.books ?? []))
      .finally(() => setLoadingBooks(false));
  }, [token]);

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
        setError(data.error?.message ?? "上传失败");
      }
    } catch {
      setError("网络错误，请重试。");
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
        <h1 className="text-2xl font-semibold tracking-tight">上传书籍</h1>
        <p className="text-muted-foreground mt-1">
          上传书籍全文，开启 AI 认知分析
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            书籍信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">书名 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：沉思录"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">作者</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="例如：马可·奥勒留"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                正文 * <span className="text-muted-foreground font-normal">（至少100个字符）</span>
              </label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="在此粘贴完整书籍文本…"
                className="min-h-[300px] resize-y font-mono text-sm"
                required
              />
              {text && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{charCount.toLocaleString()} 字符</Badge>
                  <Badge variant="secondary">{wordCount.toLocaleString()} 词</Badge>
                  <Badge variant="secondary">~{estimatedChunks} 块</Badge>
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
                  上传中…
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  上传并分析
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Previously Imported ─────────────────────────────────────────── */}
      {!loadingBooks && books.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
            <History className="h-4 w-4" />
            已导入的书籍
          </h2>
          <div className="space-y-2">
            {books.map((book) => (
              <Link key={book.id} href={`/book/${book.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(book)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
