"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, BookOpen, ChevronLeft, ChevronRight,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookData {
  id: string;
  title: string;
  author: string | null;
  rawText: string;
  status: string;
}

export default function BookReaderPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params Promise WITHOUT use()
  const [id, setId] = useState<string | null>(null);
  const [book, setBook] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reading state
  const [currentPage, setCurrentPage] = useState(1);
  const [fontSize, setFontSize] = useState(16);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  // Load book data
  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/books/${id}?includeRawText=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.book) {
          setBook(d.data.book);
        } else {
          setError("书籍未找到或无法读取原文");
        }
      })
      .catch(() => {
        setError("加载失败，请重试");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">{error || "无法加载原文"}</p>
          <Link href={`/book/${id}`}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回书籍详情
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Pagination
  const charsPerPage = 2000;
  const totalChars = book.rawText.length;
  const totalPages = Math.max(1, Math.ceil(totalChars / charsPerPage));
  const startIndex = (currentPage - 1) * charsPerPage;
  const endIndex = Math.min(startIndex + charsPerPage, totalChars);
  const currentText = book.rawText.slice(startIndex, endIndex);

  const formattedText = currentText.split("\n").map((paragraph, i) => (
    <p key={i} className="mb-4 last:mb-0">
      {paragraph || <br />}
    </p>
  ));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link
            href={`/book/${id}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium truncate">{book.title}</h1>
            {book.author && (
              <p className="text-xs text-muted-foreground truncate">{book.author}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Font size */}
            <div className="flex items-center gap-1.5">
              <Type className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                disabled={fontSize <= 12}
                className="h-6 w-6 p-0 rounded hover:bg-accent/50 transition-colors disabled:opacity-50 text-sm font-bold"
              >
                -
              </button>
              <span className="text-xs text-muted-foreground w-6 text-center tabular-nums">
                {fontSize}
              </span>
              <button
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                disabled={fontSize >= 24}
                className="h-6 w-6 p-0 rounded hover:bg-accent/50 transition-colors disabled:opacity-50 text-sm font-bold"
              >
                +
              </button>
            </div>

            {/* Page info */}
            <span className="text-xs text-muted-foreground tabular-nums">
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <article
          className="prose prose-lg max-w-none dark:prose-invert"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.8,
          }}
        >
          {formattedText}
        </article>

        {/* Navigation */}
        <nav className="mt-12 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            上一页
          </Button>

          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </nav>
      </main>
    </div>
  );
}
