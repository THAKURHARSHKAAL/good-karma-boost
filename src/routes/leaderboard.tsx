import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Crown, Loader2, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haversineKm } from "@/lib/karma";

export const Route = createFileRoute("/leaderboard")({
  component: () => (
    <AppShell title="Leaderboard">
      <Leaderboard />
    </AppShell>
  ),
});

type Row = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  score: number;
};

function Leaderboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"day" | "week" | "all">("week");
  const [scope, setScope] = useState<"global" | "local">("global");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (scope !== "local" || me) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }));
  }, [scope, me]);

  useEffect(() => {
    (async () => {
      setRows(null);
      const since =
        tab === "day"
          ? new Date(Date.now() - 86400_000).toISOString()
          : tab === "week"
            ? new Date(Date.now() - 7 * 86400_000).toISOString()
            : null;

      if (tab === "all") {
        const { data } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,karma_points,location_lat,location_lng")
          .order("karma_points", { ascending: false })
          .limit(100);
        setRows(
          (data ?? []).map((p) => ({
            user_id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            location_lat: p.location_lat,
            location_lng: p.location_lng,
            score: Number(p.karma_points),
          })),
        );
        return;
      }

      const { data: posts } = await supabase
        .from("posts")
        .select("user_id,karma_value,location_lat,location_lng,profiles:profiles!posts_user_id_fkey(username,display_name,avatar_url,location_lat,location_lng)")
        .gte("created_at", since!)
        .limit(1000);

      const totals = new Map<string, Row>();
      for (const p of posts ?? []) {
        const prof = (p as { profiles: { username: string; display_name: string | null; avatar_url: string | null; location_lat: number | null; location_lng: number | null } | null }).profiles;
        if (!prof) continue;
        const cur = totals.get(p.user_id);
        if (cur) cur.score += Number(p.karma_value);
        else
          totals.set(p.user_id, {
            user_id: p.user_id,
            username: prof.username,
            display_name: prof.display_name,
            avatar_url: prof.avatar_url,
            location_lat: prof.location_lat,
            location_lng: prof.location_lng,
            score: Number(p.karma_value),
          });
      }
      setRows([...totals.values()].sort((a, b) => b.score - a.score).slice(0, 100));
    })();
  }, [tab]);

  const filtered =
    scope === "local" && me && rows
      ? rows.filter(
          (r) =>
            r.location_lat != null && r.location_lng != null && haversineKm(me, { lat: r.location_lat, lng: r.location_lng }) <= 10,
        )
      : rows;

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <Button
          variant={scope === "global" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setScope("global")}
        >
          Global
        </Button>
        <Button
          variant={scope === "local" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setScope("local")}
        >
          <MapPin className="h-3.5 w-3.5 mr-1" /> Nearby (10km)
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="day">Daily</TabsTrigger>
          <TabsTrigger value="week">Weekly</TabsTrigger>
          <TabsTrigger value="all">All-time</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered === null ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {scope === "local" ? "No nearby karma yet." : "No data yet."}
            </div>
          ) : (
            <ol className="space-y-2">
              {filtered.map((r, i) => {
                const mine = r.user_id === user?.id;
                return (
                  <li
                    key={r.user_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      mine ? "border-primary bg-accent/40" : "border-border bg-card"
                    }`}
                  >
                    <div className="w-7 text-center font-bold text-sm">
                      {i === 0 ? <Crown className="h-5 w-5 mx-auto text-[var(--karma)]" /> : `#${i + 1}`}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={r.avatar_url ?? undefined} />
                      <AvatarFallback>{(r.display_name || r.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.display_name || r.username}</div>
                      <div className="text-xs text-muted-foreground">@{r.username}</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[var(--karma)] font-bold">
                        <Sparkles className="h-3.5 w-3.5" />
                        {r.score.toFixed(1)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
