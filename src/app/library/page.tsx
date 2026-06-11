"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, Clock, CheckCircle, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

const statusIcon = (status: string | undefined) => {
  switch (status) {
    case "completed": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case "running":
    case "pending": return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-red-400" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function LibraryPage() {
  const { token } = useAuth();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBooks = () => {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/library", { headers })
      .then((r) => r.json())
      .then((d) => setBooks(d.data?.books ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBooks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const deleteBook = async (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("确认删除这本书及其所有分析数据？此操作不可撤销。")) return;

    setDeleting(bookId);
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`/api/books/${bookId}`, { method: "DELETE", headers });
    setDeleting(null);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">书库</h1>
          <p className="text-muted-foreground mt-1">已分析的书籍</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          上传书籍
        </Link>
      </div>

      {books.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-muted-foreground font-medium">还没有书籍</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                上传一本书，开启 AI 深度认知分析
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium mt-2"
            >
              <Plus className="h-4 w-4" />
              上传你的第一本书
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link key={book.id} href={`/book/${book.id}`}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group relative">
                <CardContent className="p-5 flex flex-col h-full gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {statusIcon(book.workflow?.status || book.status)}
                      <button
                        onClick={(e) => deleteBook(book.id, e)}
                        disabled={deleting === book.id}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all"
                        title="Delete book"
                      >
                        {deleting === book.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {book.workflow?.status === "running" || book.workflow?.status === "pending" ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>分析中…</span>
                        <span>{Math.round((book.workflow.progress ?? 0) * 100)}%</span>
                      </div>
                      <Progress value={(book.workflow.progress ?? 0) * 100} className="h-1.5" />
                    </div>
                  ) : book.workflow?.status === "completed" ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">已完成</Badge>
                      <span className="text-xs text-muted-foreground">
                        {book.chunkCount} 个块已分析
                      </span>
                    </div>
                  ) : book.status === "uploaded" ? (
                    <Badge variant="outline" className="text-xs w-fit">待分析</Badge>
                  ) : book.status === "analyzing" ? (
                    <Badge variant="outline" className="text-xs w-fit border-blue-400/30 text-blue-400">分析中…</Badge>
                  ) : book.status === "failed" ? (
                    <Badge variant="destructive" className="text-xs">失败</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground capitalize">{book.status}</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
