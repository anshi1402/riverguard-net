ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'under_verification';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'closed';