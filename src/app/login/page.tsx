"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await register(email, password, name || undefined);
      } else {
        await login(email, password);
      }
      router.push("/library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "认证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-2 text-primary" />
          <CardTitle className="text-xl">ReadMeet 洞察</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRegister ? "创建账户" : "登录账户"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="昵称（选填）" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              />
            )}
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少8个字符）" required minLength={8}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
            {error && <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isRegister ? "注册" : "登录"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isRegister ? "已有账户？" : "还没有账户？"}{" "}
            <button onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-primary hover:underline font-medium">
              {isRegister ? "登录" : "注册"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
