
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.post_type AS ENUM ('help', 'donation', 'volunteer', 'kindness', 'other');
CREATE TYPE public.help_status AS ENUM ('open', 'accepted', 'completed', 'cancelled');

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_city TEXT,
  karma_points NUMERIC NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'Beginner',
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== POSTS =====
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  post_type post_type NOT NULL DEFAULT 'kindness',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_name TEXT,
  avg_rating NUMERIC NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  karma_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== RATINGS =====
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_select_all" ON public.ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings_insert_own" ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND rating BETWEEN 1 AND 10
    AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );
CREATE POLICY "ratings_update_own" ON public.ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (rating BETWEEN 1 AND 10);

-- Validate rating range with trigger (defense in depth)
CREATE OR REPLACE FUNCTION public.validate_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 10 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 10';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_rating BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.validate_rating();

-- Recalculate post karma + propagate to profile
CREATE OR REPLACE FUNCTION public.recalc_post_karma()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post_id UUID := COALESCE(NEW.post_id, OLD.post_id);
  v_avg NUMERIC; v_cnt INTEGER; v_karma NUMERIC; v_old_karma NUMERIC; v_owner UUID;
BEGIN
  SELECT COALESCE(AVG(rating),0), COUNT(*) INTO v_avg, v_cnt FROM public.ratings WHERE post_id = v_post_id;
  v_karma := v_avg * LN(v_cnt + 1);
  SELECT karma_value, user_id INTO v_old_karma, v_owner FROM public.posts WHERE id = v_post_id;
  UPDATE public.posts SET avg_rating = v_avg, vote_count = v_cnt, karma_value = v_karma WHERE id = v_post_id;
  UPDATE public.profiles
    SET karma_points = GREATEST(0, karma_points + (v_karma - COALESCE(v_old_karma,0))),
        level = CASE
          WHEN karma_points + (v_karma - COALESCE(v_old_karma,0)) >= 500 THEN 'Legend'
          WHEN karma_points + (v_karma - COALESCE(v_old_karma,0)) >= 200 THEN 'Hero'
          WHEN karma_points + (v_karma - COALESCE(v_old_karma,0)) >= 50  THEN 'Helper'
          ELSE 'Beginner'
        END
    WHERE id = v_owner;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_recalc_karma AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.recalc_post_karma();

-- ===== HELP REQUESTS =====
CREATE TABLE public.help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helper_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_name TEXT,
  status help_status NOT NULL DEFAULT 'open',
  requester_confirmed BOOLEAN NOT NULL DEFAULT false,
  helper_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_select_all" ON public.help_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "help_insert_own" ON public.help_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "help_update_involved" ON public.help_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = helper_id);
CREATE POLICY "help_delete_own" ON public.help_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Award karma when both parties confirm a help request
CREATE OR REPLACE FUNCTION public.award_help_karma()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.requester_confirmed AND NEW.helper_confirmed AND NEW.status <> 'completed' THEN
    NEW.status := 'completed';
    UPDATE public.profiles SET karma_points = karma_points + 20 WHERE id = NEW.helper_id;
    UPDATE public.profiles SET karma_points = karma_points + 5 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_help_complete BEFORE UPDATE ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.award_help_karma();

-- ===== BADGES =====
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_type)
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_select_all" ON public.badges FOR SELECT TO authenticated USING (true);

-- ===== REPORTS =====
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_admin" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_display TEXT;
BEGIN
  v_display := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)) || '_' || substr(NEW.id::text,1,4);
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (NEW.id, v_username, v_display, NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== STORAGE BUCKETS =====
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "post-media read" ON storage.objects FOR SELECT USING (bucket_id = 'post-media');
CREATE POLICY "post-media upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post-media update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post-media delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- indexes
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_posts_user ON public.posts(user_id);
CREATE INDEX idx_ratings_post ON public.ratings(post_id);
CREATE INDEX idx_help_status ON public.help_requests(status);
