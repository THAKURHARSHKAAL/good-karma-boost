import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Story = {
  id: string;
  user_id: string;
  media_url: string;
  caption: string | null;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

type Group = { user_id: string; profile: Story["profile"]; stories: Story[] };

export function StoriesTray() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ group: number; idx: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("stories")
      .select("id,user_id,media_url,caption,created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Omit<Story, "profile">[];
    const uids = [...new Set(rows.map((r) => r.user_id))];
    if (user) uids.push(user.id);
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", uids)
      : { data: [] };
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    if (user) setMyAvatar(pmap.get(user.id)?.avatar_url ?? null);
    const grouped = new Map<string, Group>();
    for (const s of rows) {
      const prof = pmap.get(s.user_id) ?? null;
      const story: Story = { ...s, profile: prof as Story["profile"] };
      const g = grouped.get(s.user_id) ?? { user_id: s.user_id, profile: story.profile, stories: [] };
      g.stories.push(story);
      grouped.set(s.user_id, g);
    }
    const arr = [...grouped.values()];
    if (user) arr.sort((a, b) => (a.user_id === user.id ? -1 : b.user_id === user.id ? 1 : 0));
    setGroups(arr);
  };

  useEffect(() => { load(); }, [user?.id]);

  const upload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("stories").upload(path, file, { upsert: false });
    if (error) return toast.error(error.message);
    const url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
    const { error: e2 } = await supabase.from("stories").insert({ user_id: user.id, media_url: url });
    if (e2) return toast.error(e2.message);
    toast.success("Story posted ✨");
    load();
  };

  const current = viewing ? groups[viewing.group]?.stories[viewing.idx] : null;

  return (
    <>
      <div className="border-b border-white/10 bg-black">
        <div className="flex gap-3 overflow-x-auto px-3 py-3 no-scrollbar">
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 shrink-0 w-16">
            <div className="relative h-16 w-16 rounded-full bg-zinc-900 border border-white/15 flex items-center justify-center">
              <Avatar className="h-14 w-14">
                <AvatarImage src={myAvatar ?? undefined} />
                <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xs">You</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-sky-500 text-black flex items-center justify-center border-2 border-black">
                <Plus className="h-3 w-3" />
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">Your story</span>
          </button>

          {groups.map((g, gi) => {
            const initials = (g.profile?.display_name || g.profile?.username || "?").slice(0, 2).toUpperCase();
            return (
              <button key={g.user_id} onClick={() => setViewing({ group: gi, idx: 0 })} className="flex flex-col items-center gap-1 shrink-0 w-16">
                <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-500">
                  <div className="rounded-full p-[2px] bg-black">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={g.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-200 text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-300 truncate w-full text-center">
                  {g.user_id === user?.id ? "You" : g.profile?.username ?? "user"}
                </span>
              </button>
            );
          })}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="p-0 bg-black border-none max-w-md h-[90vh] overflow-hidden">
          {current && viewing && (
            <div className="relative h-full w-full">
              <img src={current.media_url} alt="" className="w-full h-full object-contain bg-black" />
              <div className="absolute top-0 inset-x-0 p-3 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent">
                <Avatar className="h-8 w-8 ring-2 ring-white/20">
                  <AvatarImage src={current.profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{(current.profile?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold text-white">{current.profile?.username}</span>
                <button onClick={() => setViewing(null)} className="ml-auto text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() =>
                  setViewing((v) => {
                    if (!v) return v;
                    if (v.idx > 0) return { ...v, idx: v.idx - 1 };
                    if (v.group > 0) { const ng = v.group - 1; return { group: ng, idx: groups[ng].stories.length - 1 }; }
                    return v;
                  })
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center"
              ><ChevronLeft className="h-5 w-5" /></button>
              <button
                onClick={() =>
                  setViewing((v) => {
                    if (!v) return v;
                    const g = groups[v.group];
                    if (v.idx < g.stories.length - 1) return { ...v, idx: v.idx + 1 };
                    if (v.group < groups.length - 1) return { group: v.group + 1, idx: 0 };
                    setViewing(null);
                    return v;
                  })
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center"
              ><ChevronRight className="h-5 w-5" /></button>
              {current.caption && (
                <div className="absolute bottom-4 inset-x-4 text-center text-white text-sm bg-black/50 rounded-xl px-3 py-2">
                  {current.caption}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
