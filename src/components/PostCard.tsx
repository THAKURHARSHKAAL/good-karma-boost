import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, MoreHorizontal, Sparkles, Users, MessageCircle, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { timeAgo } from "@/lib/karma";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CommentsSheet } from "@/components/CommentsSheet";

export type Post = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  post_type: string;
  location_name: string | null;
  avg_rating: number;
  vote_count: number;
  karma_value: number;
  comment_count?: number;
  share_count?: number;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  my_rating: number | null;
};

export function PostCard({ post, onChange }: { post: Post; onChange?: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number | null>(post.my_rating);
  const [submitting, setSubmitting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareCount, setShareCount] = useState(post.share_count ?? 0);
  const isOwn = user?.id === post.user_id;

  const submit = async (value: number) => {
    if (isOwn) return toast.error("You can't rate your own post");
    if (!user) return;
    setSubmitting(true);
    setRating(value);
    const { error } = await supabase
      .from("ratings")
      .upsert({ post_id: post.id, user_id: user.id, rating: value }, { onConflict: "post_id,user_id" });
    setSubmitting(false);
    if (error) { toast.error(error.message); setRating(post.my_rating); }
    else { toast.success(post.my_rating ? "Rating updated" : "Thanks for rating!"); onChange?.(); }
  };

  const report = async () => {
    if (!user) return;
    const reason = prompt("Reason for reporting?");
    if (!reason) return;
    await supabase.from("reports").insert({ post_id: post.id, reporter_id: user.id, reason });
    toast.success("Reported. Our team will review.");
  };

  const share = async () => {
    const url = `${window.location.origin}/?post=${post.id}`;
    const payload = { title: `Karma: ${post.title}`, text: post.description ?? "Check out this good deed on Karma", url };
    try {
      if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      const next = shareCount + 1;
      setShareCount(next);
      await supabase.from("posts").update({ share_count: next }).eq("id", post.id);
      onChange?.();
    } catch { /* canceled */ }
  };

  const initials = (post.profile?.display_name || post.profile?.username || "?").slice(0, 2).toUpperCase();

  return (
    <article className="bg-black border-b border-white/10 text-white">
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="rounded-full p-[1.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-500">
          <Avatar className="h-9 w-9 ring-2 ring-black">
            <AvatarImage src={post.profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-zinc-800">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">
            {post.profile?.display_name || post.profile?.username || "Anonymous"}
          </div>
          {post.location_name && (
            <div className="text-xs text-zinc-400 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {post.location_name}
            </div>
          )}
        </div>
        <button onClick={report} className="text-zinc-400 hover:text-white p-1">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {post.image_url && (
        <div className="aspect-square bg-zinc-900 overflow-hidden">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="px-4 pt-3 pb-1 flex items-center gap-4 text-zinc-200">
        <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1.5 hover:text-sky-400">
          <MessageCircle className="h-6 w-6" />
        </button>
        <button onClick={share} className="flex items-center gap-1.5 hover:text-sky-400">
          <Share2 className="h-6 w-6" />
        </button>
        <span className="ml-auto text-[var(--karma)] text-xs font-semibold inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> +{post.karma_value.toFixed(1)}
        </span>
      </div>

      <div className="px-4 pt-1 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="capitalize text-[10px] bg-zinc-800 text-zinc-200 border-zinc-700">
            {post.post_type}
          </Badge>
          <span className="text-xs text-zinc-500">{timeAgo(post.created_at)}</span>
        </div>
        <h3 className="font-semibold text-[15px] leading-snug">{post.title}</h3>
        {post.description && (
          <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap break-words">{post.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-semibold text-white">{post.avg_rating.toFixed(1)}</span>/10
          </span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{post.vote_count}</span>
          <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1 hover:text-white">
            <MessageCircle className="h-3.5 w-3.5" />{post.comment_count ?? 0}
          </button>
          <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />{shareCount}</span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
        {!isOwn && (
          <div>
            <div className="text-xs text-zinc-400 mb-1.5">
              {rating ? `You rated ${rating}/10 — tap to change` : "Rate this good deed (1–10)"}
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={rating === n ? "default" : "outline"}
                  disabled={submitting}
                  onClick={() => submit(n)}
                  className={cn(
                    "h-9 p-0 text-xs font-semibold transition-all border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
                    rating === n && "scale-105 bg-sky-500 border-sky-500 text-black hover:bg-sky-400",
                  )}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        )}
        {isOwn && <span className="text-[10px] text-zinc-500">Your post</span>}
      </div>

      <CommentsSheet postId={post.id} open={commentsOpen} onOpenChange={setCommentsOpen} onChange={onChange} />
    </article>
  );
}
