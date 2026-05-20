import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { levelFor } from "@/lib/karma";
import { Loader2, Sparkles, LogOut, Award, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: () => (
    <AppShell title="Profile">
      <ProfilePage />
    </AppShell>
  ),
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  karma_points: number;
  level: string;
  streak_days: number;
};

function ProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<{ id: string; image_url: string | null; title: string; karma_value: number }[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [badges, setBadges] = useState<string[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: ps }, { data: all }, { data: b }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("posts").select("id,image_url,title,karma_value").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,karma_points").order("karma_points", { ascending: false }).limit(1000),
      supabase.from("badges").select("badge_type").eq("user_id", user.id),
    ]);
    setProfile(p as Profile);
    setPosts(ps ?? []);
    setBadges((b ?? []).map((x) => x.badge_type));
    if (all) setRank(all.findIndex((x) => x.id === user.id) + 1 || null);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    toast.success("Avatar updated");
    load();
  };

  if (!profile)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const lvl = levelFor(Number(profile.karma_points));

  return (
    <div>
      <div className="p-6 bg-gradient-to-b from-accent/50 to-transparent">
        <div className="flex items-start gap-4">
          <label className="relative cursor-pointer">
            <Avatar className="h-20 w-20 ring-4 ring-background shadow">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl">
                {(profile.display_name || profile.username).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow">
              <ImageIcon className="h-3 w-3" />
            </span>
          </label>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">{profile.display_name || profile.username}</h1>
            <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold bg-[var(--karma)]/15 text-[oklch(0.45_0.18_75)] dark:text-[var(--karma)] px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3" /> {lvl.name}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 text-center">
          <Stat label="Karma" value={Number(profile.karma_points).toFixed(0)} />
          <Stat label="Rank" value={rank ? `#${rank}` : "—"} />
          <Stat label="Posts" value={posts.length.toString()} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{lvl.name}</span>
            <span>{lvl.next} pts</span>
          </div>
          <Progress value={lvl.progress * 100} className="h-2" />
        </div>
      </div>

      {badges.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Award className="h-3.5 w-3.5" /> Badges
          </div>
          <div className="flex gap-2 flex-wrap">
            {badges.map((b) => (
              <span key={b} className="text-xs bg-accent text-accent-foreground rounded-full px-3 py-1 capitalize">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No posts yet — share your first good deed.</div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((p) => (
              <div key={p.id} className="aspect-square bg-muted relative overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center text-muted-foreground">
                    {p.title}
                  </div>
                )}
                <div className="absolute bottom-1 right-1 bg-background/85 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5 text-[var(--karma)]" />
                  {Number(p.karma_value).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl py-2.5">
      <div className="font-bold text-base">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
