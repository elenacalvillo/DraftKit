-- Grant 'pro' role to all existing creators
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'pro'::app_role
FROM public.creators
ON CONFLICT (user_id, role) DO NOTHING;