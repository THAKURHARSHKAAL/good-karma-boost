
-- Stories
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY stories_select_all ON public.stories FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY stories_insert_own ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY stories_delete_own ON public.stories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX stories_user_idx ON public.stories(user_id, created_at DESC);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_select_all ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_insert_own ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY comments_delete_own ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX comments_post_idx ON public.comments(post_id, created_at DESC);

-- Track share count on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;

-- Maintain comment_count
CREATE OR REPLACE FUNCTION public.update_comment_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER comments_count_trg AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- Storage bucket for stories
INSERT INTO storage.buckets (id, name, public) VALUES ('stories','stories', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "stories read" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "stories insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='stories' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "stories delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='stories' AND (storage.foldername(name))[1] = auth.uid()::text);
