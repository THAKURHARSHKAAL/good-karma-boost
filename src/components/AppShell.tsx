import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Sparkles, Loader2, Timer } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function AppShell({ children, title = "Karma" }: { children: ReactNode; title?: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [lastPostAt, setLastPostAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const tick = setInterval(() => setNowMs(Date.now()), 1000);

    const refreshLastPost = async () => {
      const { data } = await supabase
        .from("posts")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastPostAt(data?.created_at ?? null);
    };

    refreshLastPost();
    const refreshPoll = setInterval(refreshLastPost, 20000);

    return () => {
      clearInterval(tick);
      clearInterval(refreshPoll);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !lastPostAt) return;

    const elapsedMs = nowMs - new Date(lastPostAt).getTime();
    if (elapsedMs < DAY_MS) return;

    const windowsMissed = Math.floor(elapsedMs / DAY_MS);
    const storageKey = `karma_penalty_windows_${user.id}`;
    const alreadyApplied = Number(localStorage.getItem(storageKey) ?? "0");
    if (windowsMissed <= alreadyApplied) return;

    const penaltyCount = windowsMissed - alreadyApplied;
    const penalty = penaltyCount * 10;

    const applyPenalty = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("karma_points")
        .eq("id", user.id)
        .single();
      if (!profile) return;

      const current = Number(profile.karma_points ?? 0);
      const next = Math.max(0, current - penalty);
      const { error } = await supabase.from("profiles").update({ karma_points: next }).eq("id", user.id);
      if (error) return;

      localStorage.setItem(storageKey, String(windowsMissed));
    };

    applyPenalty();
  }, [lastPostAt, nowMs, user]);

  useEffect(() => {
    if (!user) return;
    if (!lastPostAt) {
      localStorage.setItem(`karma_penalty_windows_${user.id}`, "0");
      return;
    }
    const elapsedMs = nowMs - new Date(lastPostAt).getTime();
    if (elapsedMs < DAY_MS) {
      localStorage.setItem(`karma_penalty_windows_${user.id}`, "0");
    }
  }, [lastPostAt, nowMs, user]);

  const deadlineMs = useMemo(() => {
    const base = lastPostAt ? new Date(lastPostAt).getTime() : nowMs;
    return base + DAY_MS;
  }, [lastPostAt, nowMs]);

  const remaining = deadlineMs - nowMs;
  const isUrgent = remaining <= 2 * 60 * 60 * 1000;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-md grid grid-cols-3 items-center px-4 h-14">
          <div className="flex items-center">
            <span className="h-7 w-7 rounded-lg bg-sky-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-black" />
            </span>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-400">Karma</p>
            <p className="-mt-0.5 text-base font-black tracking-tight">{title}</p>
          </div>
          <div />
        </div>
        <div
          className={`mx-auto max-w-md px-4 py-2 text-xs font-semibold border-t ${
            isUrgent ? "bg-red-500/15 text-red-300 border-red-400/40" : "bg-sky-500/10 text-sky-200 border-sky-400/20"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" /> 24h karma countdown
            </span>
            <span className="tracking-widest">{formatCountdown(remaining)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-24">{children}</main>

      <div className="pointer-events-none fixed top-16 right-3 z-40">
        <div
          className={`rounded-xl border px-3 py-2 text-sm font-bold tracking-widest shadow-2xl ${
            isUrgent
              ? "border-red-400/60 bg-red-500/20 text-red-200"
              : "border-sky-400/60 bg-sky-500/20 text-sky-200"
          }`}
        >
          {formatCountdown(remaining)}
        </div>
      </div>

      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}
