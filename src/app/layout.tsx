import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BookOpen, Upload, Library, Crown, User } from "lucide-react";
import { AuthProvider } from "@/components/AuthProvider";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReadMeet 洞察 — AI 深度阅读",
  description: "AI 驱动的书籍深度分析。主题、金句、哲学、情感 — 多智能体认知流水线提取。",
};

const navItems = [
  { href: "/library", label: "书库", icon: Library },
  { href: "/upload", label: "上传", icon: Upload },
  { href: "/pricing", label: "会员", icon: Crown },
  { href: "/account", label: "账户", icon: User },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
              <Link href="/library" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
                <BookOpen className="h-5 w-5 text-primary" />
                <span>ReadMeet</span>
                <span className="text-muted-foreground font-normal">Insight</span>
              </Link>
              <nav className="flex items-center gap-1 ml-auto">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
                <UserMenu />
              </nav>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
