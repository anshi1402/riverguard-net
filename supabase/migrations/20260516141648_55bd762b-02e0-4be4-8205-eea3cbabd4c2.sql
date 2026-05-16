
-- 1. profiles: add officer_rank
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS officer_rank TEXT
  CHECK (officer_rank IN ('vao','tahsildar','rdo','collector','wrd'));

-- 2. complaints: escalation tracking
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS current_rank TEXT NOT NULL DEFAULT 'vao'
    CHECK (current_rank IN ('vao','tahsildar','rdo','collector')),
  ADD COLUMN IF NOT EXISTS escalation_level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

-- 3. water_bodies: coordinates for map
ALTER TABLE public.water_bodies
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 4. ai_alerts table
CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL,
  water_body_id uuid,
  source TEXT NOT NULL CHECK (source IN ('fencing','satellite')),
  severity public.complaint_severity NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  lat double precision,
  lng double precision,
  confidence numeric,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai alerts readable by authenticated" ON public.ai_alerts;
CREATE POLICY "ai alerts readable by authenticated"
  ON public.ai_alerts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'officer') AND district_id = public.get_user_district(auth.uid()))
  );

-- 5. rank-aware officer policies on complaints
DROP POLICY IF EXISTS "officers read district complaints" ON public.complaints;
CREATE POLICY "officers read district complaints"
  ON public.complaints FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'officer')
    AND district_id = public.get_user_district(auth.uid())
    AND (
      (SELECT officer_rank FROM public.profiles WHERE id = auth.uid()) IN ('collector')
      OR (SELECT officer_rank FROM public.profiles WHERE id = auth.uid()) = 'wrd'
      OR current_rank = (SELECT officer_rank FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "officers update district complaints" ON public.complaints;
CREATE POLICY "officers update district complaints"
  ON public.complaints FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'officer')
    AND district_id = public.get_user_district(auth.uid())
    AND (
      (SELECT officer_rank FROM public.profiles WHERE id = auth.uid()) IN ('collector','wrd')
      OR current_rank = (SELECT officer_rank FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(),'officer')
    AND district_id = public.get_user_district(auth.uid())
  );

-- 6. escalation function
CREATE OR REPLACE FUNCTION public.escalate_overdue_complaints()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  next_rank TEXT;
  count INT := 0;
BEGIN
  FOR rec IN
    SELECT id, code, current_rank, district_id
    FROM public.complaints
    WHERE status IN ('submitted','acknowledged')
      AND sla_deadline < now()
      AND current_rank <> 'collector'
  LOOP
    next_rank := CASE rec.current_rank
      WHEN 'vao' THEN 'tahsildar'
      WHEN 'tahsildar' THEN 'rdo'
      WHEN 'rdo' THEN 'collector'
      ELSE rec.current_rank
    END;
    UPDATE public.complaints
      SET current_rank = next_rank,
          escalation_level = escalation_level + 1,
          last_escalated_at = now(),
          sla_deadline = now() + interval '48 hours'
      WHERE id = rec.id;
    INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
      VALUES (rec.id, NULL, 'escalated', 'Auto-escalated: ' || rec.current_rank || ' -> ' || next_rank);
    INSERT INTO public.notifications(user_id, complaint_id, title, body)
      SELECT p.id, rec.id,
             'Complaint ' || rec.code || ' escalated to you',
             'Auto-escalation from ' || rec.current_rank
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE ur.role = 'officer'
        AND p.district_id = rec.district_id
        AND p.officer_rank = next_rank;
    count := count + 1;
  END LOOP;
  RETURN count;
END $$;
