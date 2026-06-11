"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  userId: string;
  tier: string;
  amount: number;
  status: string;
  proofUrl: string | null;
  createdAt: string;
}

const TIER_LABELS: Record<string, string> = {
  monthly: "月度 ¥59", quarterly: "季度 ¥159", yearly: "年费 ¥659",
};

export default function AdminPaymentsPage() {
  const [authed, setAuthed] = useState(false);
  const [key, setKey] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);

  const verify = async () => {
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setAuthed(true);
      localStorage.setItem("admin_key", key);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("admin_key");
    if (saved) {
      setKey(saved);
      fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: saved }),
      }).then((r) => {
        if (r.ok) setAuthed(true);
      });
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchOrders();
  }, [authed]);

  const fetchOrders = async () => {
    const res = await fetch("/api/admin/orders?status=pending", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = await res.json();
    if (data.success) setOrders(data.data.orders);
  };

  const handleAction = async (orderId: string, action: "approve" | "reject") => {
    setActioning(orderId);
    await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action, adminKey: key }),
    });
    setActioning(null);
    fetchOrders();
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto py-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> 管理员验证</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="输入管理密钥"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <Button onClick={verify} className="w-full">验证</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">支付审核</h1>
      <p className="text-muted-foreground text-sm mb-8">
        待审核订单：{orders.length} 个
      </p>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">暂无待审核订单</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge>{TIER_LABELS[o.tier] ?? o.tier}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">用户ID：{o.userId.slice(0, 8)}…</span>
                  <span className="font-medium">¥{(o.amount / 100).toFixed(0)}</span>
                </div>
                {o.proofUrl && (
                  <a href={o.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    查看付款截图
                  </a>
                )}
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={() => handleAction(o.id, "approve")}
                    disabled={actioning === o.id}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {actioning === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    通过
                  </Button>
                  <Button
                    onClick={() => handleAction(o.id, "reject")}
                    disabled={actioning === o.id}
                    variant="outline"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-1" /> 拒绝
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
