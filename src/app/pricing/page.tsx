"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PLANS = [
  {
    key: "monthly",
    name: "月度会员",
    price: "¥59",
    period: "/月",
    original: "",
    features: ["无限分析", "海报生成", "优先支持"],
  },
  {
    key: "quarterly",
    name: "季度会员",
    price: "¥159",
    period: "/季",
    original: "¥177",
    features: ["无限分析", "海报生成", "优先支持", "省 ¥18"],
    highlight: true,
  },
  {
    key: "yearly",
    name: "年费会员",
    price: "¥659",
    period: "/年",
    original: "¥708",
    features: ["无限分析", "海报生成", "优先支持", "省 ¥49"],
  },
];

export default function PricingPage() {
  const { token, user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleUpgrade = (tier: string) => {
    if (!token) {
      setError("请先登录");
      return;
    }
    setSelectedTier(tier);
    setShowModal(true);
    setMessage("");
    setError("");
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!file) { setError("请上传付款截图"); return; }
    setSubmitting(true);
    setError("");

    const form = new FormData();
    form.append("tier", selectedTier);
    form.append("proof", file);

    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/payments/submit", { method: "POST", headers, body: form });
    const data = await res.json();

    if (data.success) {
      setMessage("订单已提交！请等待管理员审核通过。通常在24小时内完成。");
    } else {
      setError(data.error?.message ?? "提交失败，请重试");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">升级会员</h1>
        <p className="text-muted-foreground mt-2">解锁无限 AI 书籍分析</p>
        {user && (
          <p className="text-sm text-muted-foreground mt-1">
            当前：{user.email}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-12">
        {PLANS.map((plan) => (
          <Card key={plan.key} className={plan.highlight ? "border-primary/50 ring-1 ring-primary/20" : ""}>
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              {plan.highlight && <Badge className="bg-primary/10 text-primary text-xs">推荐</Badge>}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <div>
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
                {plan.original && (
                  <p className="text-xs text-muted-foreground line-through mt-1">{plan.original}</p>
                )}
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 w-full">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 justify-center">
                    <Check className="h-4 w-4 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleUpgrade(plan.key)}
                variant={plan.highlight ? "default" : "outline"}
                className="w-full mt-2"
              >
                立即升级 <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-background rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">
              {PLANS.find((p) => p.key === selectedTier)?.name} — 提交付款凭证
            </h2>

            {!message ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                  <p>请使用微信或支付宝扫描下方二维码付款：</p>
                  <p className="text-muted-foreground text-xs">
                    金额：{PLANS.find((p) => p.key === selectedTier)?.price}
                  </p>
                  <p className="text-amber-400 text-xs font-medium">
                    请备注您的邮箱：{user?.email ?? ""}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium block">上传付款截图</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                  {file && <p className="text-xs text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(0)}KB)</p>}
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex gap-3">
                  <Button onClick={() => setShowModal(false)} variant="outline" className="flex-1">取消</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "提交审核"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-emerald-400 text-sm">{message}</p>
                <Button onClick={() => setShowModal(false)} className="w-full">关闭</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
