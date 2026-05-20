
REVOKE EXECUTE ON FUNCTION public.validate_rating() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_post_karma() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.award_help_karma() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
