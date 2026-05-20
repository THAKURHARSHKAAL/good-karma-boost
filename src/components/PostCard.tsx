import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, MoreHorizontal, Sparkles, Users, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { timeAgo } from "@/lib/karma";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  my_rating: number | null;
};

export function PostCard({ post, onChange }: { post: Post; onChange?: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number | null>(post.my_rating);
  const [submitting, setSubmitting] = useState(false);
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
    if (error) {
      toast.error(error.message);
      setRating(post.my_rating);
    } else {
      toast.success(post.my_rating ? "Rating updated" : "Thanks for rating!");
      onChange?.();
    }
  };

  const report = async () => {
    if (!user) return;
    const reason = prompt("Reason for reporting?");
    if (!reason) return;
    await supabase.from("reports").insert({ post_id: post.id, reporter_id: user.id, reason });
    toast.success("Reported. Our team will review.");
  };

  const initials = (post.profile?.display_name || post.profile?.username || "?").slice(0, 2).toUpperCase();

  return (
    <article className="bg-card border-b border-border">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-9 w-9 ring-2 ring-primary/30">
          <AvatarImage src={post.profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">
            {post.profile?.display_name || post.profile?.username || "Anonymous"}
          </div>
          {post.location_name && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {post.location_name}
            </div>
          )}
        </div>
        <button onClick={report} className="text-muted-foreground hover:text-foreground p-1">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {post.image_url && (
        <div className="aspect-square bg-muted overflow-hidden">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="capitalize text-[10px]">
            {post.post_type}
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
        </div>
        <h3 className="font-semibold text-[15px] leading-snug">{post.title}</h3>
        {post.description && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{post.description}</p>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-[var(--karma)]" />
              <span className="font-semibold text-foreground">{post.avg_rating.toFixed(1)}</span>
              <span>/ 10</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {post.vote_count} voters
            </span>
            <span className="text-[var(--karma)] font-semibold">+{post.karma_value.toFixed(1)} karma</span>
          </div>
          {isOwn && <span className="text-[10px] text-muted-foreground">Your post</span>}
        </div>

        {!isOwn && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">
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
                    "h-9 p-0 text-xs font-semibold transition-all",
                    rating === n && "scale-105",
                  )}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
