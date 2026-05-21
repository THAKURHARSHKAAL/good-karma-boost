import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/karma";

type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

export function CommentsSheet({
  postId, open, onOpenChange, onChange,
}: { postId: string; open: boolean; onOpenChange: (o: boolean) => void; onChange?: () => void }) {
  const { user } = useAuth();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    const rows = (data ?? []) as Omit<Comment, "profile">[];
    const uids = [...new Set(rows.map((r) => r.user_id))];
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", uids)
      : { data: [] };
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    setList(rows.map((r) => ({ ...r, profile: (pmap.get(r.user_id) as Comment["profile"]) ?? null })));
  };

  useEffect(() => { if (open) load(); }, [open, postId]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, body: text.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
    load();
    onChange?.();
  };

  const remove = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    load();
    onChange?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-zinc-950 text-white border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-white/10">
          <SheetTitle className="text-white text-base">Comments</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {list === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
          ) : list.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-8">Be the first to comment</p>
          ) : list.map((c) => (
            <div key={c.id} className="flex gap-2 items-start">
              <Avatar className="h-8 w-8">
                <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-zinc-800 text-[10px]">{(c.profile?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs">
                  <span className="font-semibold">{c.profile?.username ?? "user"}</span>
                  <span className="text-zinc-500 ml-2">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-zinc-100 break-words">{c.body}</p>
              </div>
              {c.user_id === user?.id && (
                <button onClick={() => remove(c.id)} className="text-zinc-500 hover:text-red-400 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 p-3 flex gap-2 bg-black">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Add a comment…"
            className="bg-zinc-900 border-zinc-700 text-white"
          />
          <Button onClick={send} disabled={sending || !text.trim()} className="bg-sky-500 text-black hover:bg-sky-400">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
