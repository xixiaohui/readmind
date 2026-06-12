"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Globe, BookOpen, Loader2, Sparkles,
  Hash, Quote, ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface PublicBook {
  id: string;
  title: string;
  author: string | null;
  status: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  stats: {
    analysisCount: number;
    hasThemes: boolean;
    hasQuotes: boolean;
    hasSummary: boolean;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function DiscoverPage() {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);

  const fetchBooks = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
      sort,
      order,
      ...(search && { search }),
    });

    fetch(`/api/books/public?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setBooks(d.data.books);
          setPagination(d.data.pagination);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, order]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/library"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> 返回书库
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          发现书籍
        </h1>
        <p className="text-muted-foreground mt-1">
          浏览社区成员公开的 AI 分析书籍
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜索书名或作者..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v ?? "createdAt")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">最新上传</SelectItem>
                <SelectItem value="title">书名</SelectItem>
                <SelectItem value="completedAt">最近完成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={order} onValueChange={(v) => setOrder(v ?? "desc")}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="顺序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">降序</SelectItem>
                <SelectItem value="asc">升序</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">
              搜索
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Book Grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : books.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <Globe className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">暂无公开的书籍</p>
            <p className="text-sm text-muted-foreground/70 text-center max-w-sm">
              {search ? "没有找到匹配的书籍，试试其他关键词" : "成为第一个分享书籍分析的用户！"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link key={book.id} href={`/book/${book.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                <CardContent className="p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {book.status === "completed" ? (
                      <Badge className="bg-emerald-400/10 text-emerald-400 text-xs">
                        <Sparkles className="h-3 w-3 mr-1" /> 已完成
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        分析中
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {book.chunkCount} 块
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {book.stats.hasSummary && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> 摘要
                      </span>
                    )}
                    {book.stats.hasThemes && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> 主题
                      </span>
                    )}
                    {book.stats.hasQuotes && (
                      <span className="flex items-center gap-1">
                        <Quote className="h-3 w-3" /> 金句
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = `/book/${book.id}/reader`;
                      }}
                      className="flex items-center gap-1 hover:text-primary transition-colors ml-auto"
                    >
                      <BookOpen className="h-3 w-3" />
                      原文
                    </button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {pagination.page} 页，共 {pagination.totalPages} 页
            ({pagination.total} 本书)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
