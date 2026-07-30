CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_district UUID;
  v_district_name TEXT;
  v_rank TEXT;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'citizen');
  v_district_name := NEW.raw_user_meta_data->>'district';
  v_rank := NEW.raw_user_meta_data->>'officer_rank';

  IF v_district_name IS NOT NULL THEN
    SELECT id INTO v_district FROM public.districts WHERE name = v_district_name LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, district_id, officer_rank)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone',
    v_district,
    CASE WHEN v_role = 'officer' AND v_rank IN ('vao','tahsildar','rdo','collector') THEN v_rank ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    district_id = EXCLUDED.district_id,
    officer_rank = EXCLUDED.officer_rank;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $function$;

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
         NEW.type::text || ' reported in ' || COALESCE((SELECT d.name FROM public.districts d WHERE d.id = NEW.district_id), 'pilot district')
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'officer'
    AND p.officer_rank = 'vao'
    AND p.district_id = NEW.district_id;

  RETURN NEW;
END $function$;

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
        AND p.district_id = rec.district_id
        AND p.officer_rank = next_rank;

    count := count + 1;
  END LOOP;

  RETURN count;
END $function$;

DROP POLICY IF EXISTS "officers read district complaints" ON public.complaints;
CREATE POLICY "officers read district complaints"
ON public.complaints FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'officer'::app_role)
  AND district_id = get_user_district(auth.uid())
  AND (
    (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) IN ('vao','collector')
    OR escalation_level > 0
  )
);

DROP POLICY IF EXISTS "officers update district complaints" ON public.complaints;
CREATE POLICY "officers update district complaints"
ON public.complaints FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'officer'::app_role)
  AND district_id = get_user_district(auth.uid())
  AND (
    (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) = 'collector'
    OR current_rank = (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid())
  )
)
WITH CHECK (has_role(auth.uid(), 'officer'::app_role));