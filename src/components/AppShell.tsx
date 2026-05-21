import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Loader2, Sparkles } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

export function AppShell({ children }: { children: ReactNode; title?: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [lastPostAt, setLastPostAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = async () => {
      const { data } = await supabase
        .from("posts").select("created_at").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setLastPostAt(data?.created_at ?? null);
    };
    refresh();
    const p = setInterval(refresh, 20000);
    return () => { clearInterval(tick); clearInterval(p); };
  }, [user?.id]);

  const deadline = useMemo(
    () => (lastPostAt ? new Date(lastPostAt).getTime() : now) + DAY_MS,
    [lastPostAt, now],
  );
  const remaining = deadline - now;
  const urgent = remaining <= 2 * 60 * 60 * 1000;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-14">
          <span className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <h1 className="font-signature text-3xl leading-none bg-gradient-to-r from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
            Karma
          </h1>
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums tracking-widest ${
              urgent
                ? "border-red-500/70 bg-red-500/15 text-red-400 karma-blink"
                : "border-white/15 bg-white/5 text-zinc-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${urgent ? "bg-red-500" : "bg-emerald-400"}`} />
            {fmt(remaining)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-24">{children}</main>

      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}
