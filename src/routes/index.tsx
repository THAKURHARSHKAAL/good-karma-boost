import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type Post } from "@/components/PostCard";
import { AppShell } from "@/components/AppShell";
import { StoriesTray } from "@/components/StoriesTray";
import { useAuth } from "@/lib/auth";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: FeedPage,
});

function FeedPage() {
  return (
    <AppShell>
      <StoriesTray />
      <Feed />
    </AppShell>
  );
}

function Feed() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);

  const load = async () => {
    const { data: postRows } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!postRows) return setPosts([]);

    const userIds = [...new Set(postRows.map((p) => p.user_id))];
    const ids = postRows.map((p) => p.id);
    const [{ data: profiles }, { data: myRatings }] = await Promise.all([
      supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", userIds),
      user
        ? supabase.from("ratings").select("post_id,rating").in("post_id", ids).eq("user_id", user.id)
        : Promise.resolve({ data: [] as { post_id: string; rating: number }[] }),
    ]);

    const pmap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const rmap = new Map((myRatings ?? []).map((r) => [r.post_id, r.rating]));
    setPosts(
      postRows.map((p) => ({
        ...p,
        profile: pmap.get(p.user_id) ?? null,
        my_rating: rmap.get(p.id) ?? null,
      })) as Post[],
    );
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  if (authLoading || posts === null) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
        <h2 className="font-semibold text-lg">No good deeds yet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Be the first to share a kind act and earn karma.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/10">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onChange={load} />
      ))}
    </div>
  );
}
