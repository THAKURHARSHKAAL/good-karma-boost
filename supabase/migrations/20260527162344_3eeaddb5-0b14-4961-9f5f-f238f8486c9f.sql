
-- 1) user_roles: prevent privilege escalation
CREATE POLICY user_roles_insert_admin ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_update_admin ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_delete_admin ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Fix search_path on validate_rating
CREATE OR REPLACE FUNCTION public.validate_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 10 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 10';
  END IF;
  RETURN NEW;
END $$;

-- 3) Revoke client EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_help_karma()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_post_karma()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comment_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_rating()    FROM PUBLIC, anon, authenticated;

-- 4) Hide precise GPS on profiles via column-level grants
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, karma_points, level,
              streak_days, bio, location_city, last_active_date, created_at, updated_at)
  ON public.profiles TO authenticated;

-- 5) Hide precise GPS on help_requests via column-level grants
REVOKE SELECT ON public.help_requests FROM anon, authenticated;
GRANT SELECT (id, user_id, helper_id, title, description, location_name, status,
              requester_confirmed, helper_confirmed, created_at)
  ON public.help_requests TO authenticated;

-- 6) Nearby leaderboard RPC (uses coords internally, never returns them)
CREATE OR REPLACE FUNCTION public.nearby_leaderboard(
  _lat double precision, _lng double precision,
  _km double precision DEFAULT 10, _limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text,
  karma_points numeric, distance_km double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.karma_points,
    (6371 * acos(LEAST(1,
       cos(radians(_lat)) * cos(radians(p.location_lat)) *
       cos(radians(p.location_lng) - radians(_lng)) +
       sin(radians(_lat)) * sin(radians(p.location_lat))
    ))) AS distance_km
  FROM public.profiles p
  WHERE p.location_lat IS NOT NULL AND p.location_lng IS NOT NULL
    AND (6371 * acos(LEAST(1,
       cos(radians(_lat)) * cos(radians(p.location_lat)) *
       cos(radians(p.location_lng) - radians(_lng)) +
       sin(radians(_lat)) * sin(radians(p.location_lat))
    ))) <= _km
  ORDER BY p.karma_points DESC
  LIMIT _limit
$$;
REVOKE EXECUTE ON FUNCTION public.nearby_leaderboard(double precision, double precision, double precision, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_leaderboard(double precision, double precision, double precision, int) TO authenticated;

-- 7) Remove broad listing on public storage buckets (public URLs still work)
DROP POLICY IF EXISTS "post-media read" ON storage.objects;
DROP POLICY IF EXISTS "avatars read"    ON storage.objects;
DROP POLICY IF EXISTS "stories read"    ON storage.objects;

-- Owners can still list their own folder (needed for app management)
CREATE POLICY "post-media list own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars list own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "stories list own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 8) Cleanup expired story media (objects + rows)
CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM storage.objects
    WHERE bucket_id = 'stories'
      AND name IN (
        SELECT regexp_replace(media_url, '^.*/stories/', '')
        FROM public.stories
        WHERE expires_at <= now()
      );
  DELETE FROM public.stories WHERE expires_at <= now();
END $$;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_stories() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_stories() TO authenticated;
