import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { levelFor } from "@/lib/karma";
import {
  Loader2,
  Sparkles,
  LogOut,
  Award,
  Image as ImageIcon,
  MapPin,
  Flame,
  Save,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
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
  location_city: string | null;
};

function ProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<
    { id: string; image_url: string | null; title: string; karma_value: number }[]
  >([]);
  const [rank, setRank] = useState<number | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState({ display_name: "", username: "", bio: "", location_city: "" });

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: ps }, { data: all }, { data: b }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("posts")
        .select("id,image_url,title,karma_value")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,karma_points")
        .order("karma_points", { ascending: false })
        .limit(1000),
      supabase.from("badges").select("badge_type").eq("user_id", user.id),
    ]);
    const loaded = p as Profile;
    setProfile(loaded);
    setPosts(ps ?? []);
    setBadges((b ?? []).map((x) => x.badge_type));
    setForm({
      display_name: loaded?.display_name ?? "",
      username: loaded?.username ?? "",
      bio: loaded?.bio ?? "",
      location_city: loaded?.location_city ?? "",
    });
    if (all) setRank(all.findIndex((x) => x.id === user.id) + 1 || null);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      form.display_name !== (profile.display_name ?? "") ||
      form.username !== profile.username ||
      form.bio !== (profile.bio ?? "") ||
      form.location_city !== (profile.location_city ?? "")
    );
  }, [form, profile]);

  const saveProfile = async () => {
    if (!user || !hasChanges) return;
    if (!form.username.trim()) return toast.error("Username is required");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        username: form.username.trim().toLowerCase().replace(/\s+/g, "_"),
        bio: form.bio.trim() || null,
        location_city: form.location_city.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setShowEditor(false);
    load();
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const url =
      supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + `?t=${Date.now()}`;
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
    <div className="min-h-full border-x border-white/10 bg-black text-white">
      <div className="h-28 bg-gradient-to-b from-sky-500/30 via-sky-500/10 to-transparent" />
      <div className="px-4 pb-4 -mt-12 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <label className="relative cursor-pointer">
            <Avatar className="h-24 w-24 ring-4 ring-black border border-white/20">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl bg-zinc-800 text-white">
                {(profile.display_name || profile.username).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-sky-500 p-2 text-black">
              <ImageIcon className="h-3 w-3" />
            </span>
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="mt-14 rounded-full border-white/20 bg-black/80">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950 text-white border-white/10">
              <DropdownMenuItem onClick={() => setShowEditor((v) => !v)}>
                <Pencil className="h-4 w-4" /> Edit profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-red-400">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3">
          <h1 className="font-bold text-xl leading-tight truncate">{profile.display_name || profile.username}</h1>
          <p className="text-sm text-zinc-400 truncate">@{profile.username}</p>
          {profile.bio && <p className="text-sm text-zinc-200 mt-2">{profile.bio}</p>}
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location_city || "Unknown"}</span>
            <span className="inline-flex items-center gap-1 text-yellow-300"><Sparkles className="h-3 w-3" /> {lvl.name}</span>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200">Karma</p>
            <p className="text-2xl font-black text-white">{Number(profile.karma_points).toFixed(0)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <Stat label="Rank" value={rank ? `#${rank}` : "—"} />
          <Stat label="Posts" value={posts.length.toString()} />
          <Stat label="Streak" value={`${profile.streak_days}`} icon={<Flame className="h-3 w-3" />} />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
            <span>{lvl.name}</span>
            <span>{lvl.next} pts</span>
          </div>
          <Progress value={lvl.progress * 100} className="h-2 bg-zinc-800" />
        </div>
      </div>

      {showEditor && (
        <div className="px-4 py-4 border-b border-white/10 space-y-3 bg-zinc-950/60">
          <h2 className="text-sm font-semibold">Edit profile</h2>
          <div className="grid grid-cols-1 gap-2">
            <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Name" className="bg-zinc-900 border-zinc-700 text-white" />
            <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="Username" className="bg-zinc-900 border-zinc-700 text-white" />
            <Input value={form.location_city} onChange={(e) => setForm((f) => ({ ...f, location_city: e.target.value }))} placeholder="City" className="bg-zinc-900 border-zinc-700 text-white" />
            <Textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Bio" className="bg-zinc-900 border-zinc-700 text-white min-h-20" maxLength={200} />
          </div>
          <div className="flex items-center justify-end">
            <Button onClick={saveProfile} disabled={!hasChanges || saving} className="rounded-full bg-sky-500 text-black hover:bg-sky-400">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </div>
        </div>
      )}

      {badges.length > 0 && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-xs font-semibold text-zinc-400 mb-2 flex items-center gap-1">
            <Award className="h-3.5 w-3.5" /> Badges
          </div>
          <div className="flex gap-2 flex-wrap">
            {badges.map((b) => (
              <span key={b} className="text-xs bg-zinc-800 text-zinc-100 rounded-full px-3 py-1 capitalize">{b}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        {posts.length === 0 ? (
          <div className="text-center py-12 text-sm text-zinc-500">No posts yet — share your first good deed.</div>
        ) : (
          <div className="grid grid-cols-3 gap-[1px] bg-zinc-900">
            {posts.map((p) => (
              <div key={p.id} className="aspect-square bg-zinc-800 relative overflow-hidden">
                {p.image_url ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center text-zinc-400">{p.title}</div>}
                <div className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5 text-yellow-300" />
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

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 py-2.5">
      <div className="font-bold text-base inline-flex items-center gap-1">{icon}{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
