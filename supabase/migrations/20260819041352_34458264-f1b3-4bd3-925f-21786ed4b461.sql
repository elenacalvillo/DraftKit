-- Scoped cleanup of QA sandbox data only (two @draftkit.app test creators).
DELETE FROM public.collab_requests
WHERE creator_id IN ('7daefd98-6d1d-4e15-95e0-018dc4072444','750decb8-291d-41b8-a405-520553a7f34e');

DELETE FROM public.project_members
WHERE project_id = '73515c59-b81c-4b51-87c4-1f0125e016e7';

DELETE FROM public.projects
WHERE id = '73515c59-b81c-4b51-87c4-1f0125e016e7';

DELETE FROM public.user_roles
WHERE user_id = '0c00916a-32c9-4c4e-a6fa-bb968b73b5d5';

DELETE FROM public.creators
WHERE id IN ('7daefd98-6d1d-4e15-95e0-018dc4072444','750decb8-291d-41b8-a405-520553a7f34e');