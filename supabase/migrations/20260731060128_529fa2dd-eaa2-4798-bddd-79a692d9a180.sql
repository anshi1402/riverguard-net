CREATE OR REPLACE FUNCTION public.sla_hours_for_rank(_rank text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _rank WHEN 'vao' THEN 48 WHEN 'tahsildar' THEN 72 WHEN 'rdo' THEN 72 ELSE 72 END
$$;

CREATE OR REPLACE FUNCTION public.escalate_overdue_complaints()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  next_rank TEXT;
  n INT := 0;
BEGIN
  FOR rec IN
    SELECT id, code, current_rank, district_id, citizen_id, escalation_level
    FROM public.complaints
    WHERE status NOT IN ('resolved','rejected','closed')
      AND sla_deadline < now()
      AND current_rank <> 'collector'
  LOOP
    next_rank := CASE rec.current_rank WHEN 'vao' THEN 'tahsildar' WHEN 'tahsildar' THEN 'rdo' ELSE 'collector' END;

    UPDATE public.complaints
    SET current_rank = next_rank,
        escalation_level = COALESCE(rec.escalation_level,0) + 1,
        last_escalated_at = now(),
        status = 'escalated',
        sla_deadline = now() + (public.sla_hours_for_rank(next_rank) || ' hours')::interval
    WHERE id = rec.id;

    INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
    VALUES (rec.id, NULL, 'escalated',
            'SLA expired at ' || rec.current_rank || ' — auto-escalated to ' || next_rank);

    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    VALUES (rec.citizen_id, rec.id, 'Complaint ' || rec.code || ' escalated',
            'SLA expired. Escalated to ' || upper(next_rank) || '.');

    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    SELECT p.id, rec.id, 'Escalated complaint ' || rec.code, 'SLA breached at ' || rec.current_rank || '. Action required.'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'officer' AND p.officer_rank = next_rank AND p.district_id = rec.district_id;

    n := n + 1;
  END LOOP;

  -- Collector stage: final authority, flag as SLA breached (no further escalation)
  UPDATE public.complaints
  SET status = 'sla_breached'
  WHERE current_rank = 'collector'
    AND sla_deadline < now()
    AND status NOT IN ('resolved','rejected','closed','sla_breached');

  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.notify_sla_warnings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rec RECORD; n INT := 0;
BEGIN
  FOR rec IN
    SELECT c.id, c.code, c.current_rank, c.district_id, c.sla_deadline
    FROM public.complaints c
    WHERE c.status NOT IN ('resolved','rejected','closed')
      AND c.sla_deadline > now()
      AND c.sla_deadline < now() + interval '12 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications nt
        WHERE nt.complaint_id = c.id AND nt.title LIKE 'SLA deadline approaching%'
          AND nt.created_at > now() - interval '12 hours')
  LOOP
    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    SELECT p.id, rec.id, 'SLA deadline approaching — ' || rec.code,
           'Due ' || to_char(rec.sla_deadline, 'DD Mon HH24:MI') || '. Resolve or escalate.'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'officer' AND p.officer_rank = rec.current_rank AND p.district_id = rec.district_id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.escalate_overdue_complaints() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_sla_warnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_complaints() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_sla_warnings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sla_hours_for_rank(text) TO authenticated, service_role;

-- Richer audit trail + role-aware notifications on every complaint update
CREATE OR REPLACE FUNCTION public.log_complaint_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
    VALUES (NEW.id, auth.uid(), 'status_changed',
            OLD.status::text || ' -> ' || NEW.status::text ||
            COALESCE(' · ' || NULLIF(NEW.resolution_notes,''), ''));

    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    VALUES (NEW.citizen_id, NEW.id, 'Complaint ' || NEW.code || ' updated', 'Status: ' || NEW.status::text);

    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  END IF;

  IF NEW.current_rank IS DISTINCT FROM OLD.current_rank THEN
    INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
    VALUES (NEW.id, auth.uid(), 'escalated', 'Handled by ' || OLD.current_rank || ' -> ' || NEW.current_rank);

    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    SELECT p.id, NEW.id, 'Escalated complaint ' || NEW.code, 'Now at your stage (' || NEW.current_rank || ').'
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'officer' AND p.officer_rank = NEW.current_rank AND p.district_id = NEW.district_id;
  END IF;

  RETURN NEW;
END $$;