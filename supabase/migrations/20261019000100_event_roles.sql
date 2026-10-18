-- Committee roles used by event setup (EM08), review (RV/EM2x) and the program (CH01).
-- Kept in its own migration: new enum values must be committed before other statements use them.
-- 'chair' stays as the general chair; the others are the canvas roles.

alter type public.venue_role add value if not exists 'program_chair';
alter type public.venue_role add value if not exists 'deputy_chair';
alter type public.venue_role add value if not exists 'ceb_chair';
alter type public.venue_role add value if not exists 'publication_chair';
alter type public.venue_role add value if not exists 'registration_chair';
alter type public.venue_role add value if not exists 'session_chair';

alter type public.venue_date_kind add value if not exists 'rebuttal';
alter type public.venue_date_kind add value if not exists 'review';
alter type public.venue_date_kind add value if not exists 'internal';

-- files beyond the first submission: revision (SB14), highlighted changes, camera-ready (SB12), slides (CH01), supplementary
alter type public.submission_file_role add value if not exists 'revision';
alter type public.submission_file_role add value if not exists 'highlighted';
alter type public.submission_file_role add value if not exists 'final';
alter type public.submission_file_role add value if not exists 'slides';
alter type public.submission_file_role add value if not exists 'supplementary';
