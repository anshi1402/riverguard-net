-- Keep every new complaint starting at VAO
ALTER TABLE public.complaints
  ALTER COLUMN current_rank SET DEFAULT 'vao';

UPDATE public.complaints
SET current_rank = 'vao'
WHERE current_rank IS NULL;

-- Senior authority dashboards need district overview access; Collector needs statewide overview.
DROP POLICY IF EXISTS "officers read district complaints" ON public.complaints;
CREATE POLICY "officers read district complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'officer'::public.app_role)
    AND (
      (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) = 'collector'
      OR district_id = public.get_user_district(auth.uid())
    )
  );

-- Keep edits stage-aware: VAO/Tahsildar/RDO act only at their stage; WRD can handle district technical cases; Collector can act statewide.
DROP POLICY IF EXISTS "officers update district complaints" ON public.complaints;
CREATE POLICY "officers update district complaints"
  ON public.complaints
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'officer'::public.app_role)
    AND (
      (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) = 'collector'
      OR (
        district_id = public.get_user_district(auth.uid())
        AND (
          (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) = 'wrd'
          OR current_rank = (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'officer'::public.app_role)
    AND (
      (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) = 'collector'
      OR district_id = public.get_user_district(auth.uid())
    )
  );

-- New complaint notification: send to VAO in the complaint district and WRD for technical water cases.
CREATE OR REPLACE FUNCTION public.log_complaint_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
  VALUES (NEW.id, NEW.citizen_id, 'submitted', 'Complaint filed and routed to VAO');

  INSERT INTO public.notifications(user_id, complaint_id, title, body)
  SELECT ur.user_id, NEW.id, 'New complaint ' || NEW.code, NEW.type::text || ' reported'
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  INSERT INTO public.notifications(user_id, complaint_id, title, body)
  SELECT p.id, NEW.id,
         'Complaint ' || NEW.code || ' assigned for VAO verification',
         NEW.type::text || ' reported in your district'
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'officer'
    AND p.district_id = NEW.district_id
    AND p.officer_rank = 'vao';

  IF NEW.type::text IN ('water_flow_obstruction', 'supply_channel', 'surplus_channel') THEN
    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    SELECT p.id, NEW.id,
           'Technical water case ' || NEW.code,
           NEW.type::text || ' requires WRD visibility'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'officer'
      AND p.district_id = NEW.district_id
      AND p.officer_rank = 'wrd';
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS complaint_insert_event ON public.complaints;
CREATE TRIGGER complaint_insert_event
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.log_complaint_insert();

DROP TRIGGER IF EXISTS complaint_update_event ON public.complaints;
CREATE TRIGGER complaint_update_event
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.log_complaint_update();

-- Escalate any unresolved SLA-breached complaint through the authority chain.
CREATE OR REPLACE FUNCTION public.escalate_overdue_complaints()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  next_rank TEXT;
  count INT := 0;
BEGIN
  FOR rec IN
    SELECT id, code, current_rank, district_id
    FROM public.complaints
    WHERE status <> 'resolved'
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
        AND (p.district_id = rec.district_id OR p.officer_rank = 'collector')
        AND p.officer_rank = next_rank;

    count := count + 1;
  END LOOP;

  RETURN count;
END $function$;