"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
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

  useEffect(() => {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/library", { headers })
      .then((r) => r.json())
      .then((d) => setBooks(d.data?.books ?? []))
      .finally(() => setLoading(false));
  }, [token]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-muted-foreground mt-1">Your analyzed books</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Upload Book
        </Link>
      </div>

      {books.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-muted-foreground font-medium">No books yet</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                Upload a book to unlock AI-powered cognitive analysis
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium mt-2"
            >
              <Plus className="h-4 w-4" />
              Upload Your First Book
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link key={book.id} href={`/book/${book.id}`}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
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
                    {statusIcon(book.workflow?.status)}
                  </div>

                  {book.workflow?.status === "running" || book.workflow?.status === "pending" ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Analyzing…</span>
                        <span>{Math.round((book.workflow.progress ?? 0) * 100)}%</span>
                      </div>
                      <Progress value={(book.workflow.progress ?? 0) * 100} className="h-1.5" />
                    </div>
                  ) : book.workflow?.status === "completed" ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Completed</Badge>
                      <span className="text-xs text-muted-foreground">
                        {book.chunkCount} chunks analyzed
                      </span>
                    </div>
                  ) : book.status === "uploaded" ? (
                    <Badge variant="outline" className="text-xs w-fit">Ready to analyze</Badge>
                  ) : book.status === "analyzing" ? (
                    <Badge variant="outline" className="text-xs w-fit border-blue-400/30 text-blue-400">Analyzing…</Badge>
                  ) : book.status === "failed" ? (
                    <Badge variant="destructive" className="text-xs">Failed</Badge>
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
