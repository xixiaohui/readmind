"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Crown, Clock, BarChart3, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

const TIER_LABELS: Record<string, string> = {
  free: "免费用户",
  monthly: "月度会员",
  quarterly: "季度会员",
  yearly: "年费会员",
};

export default function AccountPage() {
  const { token } = useAuth();
  const [data, setData] = useState<{
    user: { email: string; name: string | null };
    membership: { tier: string; expiresAt: string | null };
    usage: { count: number; limit: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/auth/me", { headers })
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) {
    return <div className="text-center py-24 text-muted-foreground">请先登录</div>;
  }

  const { membership, usage } = data;
  const isPaid = membership.tier !== "free";

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">账户</h1>

      {/* Membership Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isPaid ? <Crown className="h-4 w-4 text-amber-400" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            会员状态
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">当前等级</span>
            <Badge className={isPaid ? "bg-amber-400/10 text-amber-400" : ""}>
              {TIER_LABELS[membership.tier] ?? membership.tier}
            </Badge>
          </div>
          {membership.expiresAt ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">到期时间</span>
              <span className="text-sm">{new Date(membership.expiresAt).toLocaleDateString("zh-CN")}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">到期时间</span>
              <span className="text-sm text-muted-foreground">永久（免费）</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            使用统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">本月分析</span>
            <span className="text-2xl font-bold tabular-nums">
              {usage.count}
              <span className="text-lg text-muted-foreground font-normal">
                /{usage.limit === -1 ? "∞" : usage.limit}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {!isPaid && (
        <Link href="/pricing">
          <Button className="w-full gap-2">
            <Crown className="h-4 w-4" /> 升级会员 <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}
