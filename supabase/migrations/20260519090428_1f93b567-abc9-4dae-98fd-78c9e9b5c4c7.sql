-- Officers need overview visibility across pilot districts for the authority workflow.
DROP POLICY IF EXISTS "officers read district complaints" ON public.complaints;
CREATE POLICY "officers read district complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'officer'::public.app_role));

-- Edits stay workflow-stage based; WRD handles technical cases, Collector can act at final escalation.
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
        (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid()) = 'wrd'
        AND type::text IN ('water_flow_obstruction', 'supply_channel', 'surplus_channel')
      )
      OR current_rank = (SELECT p.officer_rank FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
  WITH CHECK (public.has_role(auth.uid(), 'officer'::public.app_role));

-- Preserve selected authority rank when new accounts are created.
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
    CASE WHEN v_role = 'officer' AND v_rank IN ('vao','tahsildar','rdo','collector','wrd') THEN v_rank ELSE NULL END
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- New complaint notifications should reach the VAO queue in this pilot workflow.
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
    AND p.officer_rank = 'vao';

  IF NEW.type::text IN ('water_flow_obstruction', 'supply_channel', 'surplus_channel') THEN
    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    SELECT p.id, NEW.id,
           'Technical water case ' || NEW.code,
           NEW.type::text || ' requires WRD visibility'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'officer'
      AND p.officer_rank = 'wrd';
  END IF;

  RETURN NEW;
END $function$;