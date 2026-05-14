
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'officer', 'citizen');
CREATE TYPE public.complaint_status AS ENUM ('submitted','assigned','in_progress','resolved','sla_breached','reinvestigating','escalated');
CREATE TYPE public.complaint_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.complaint_type AS ENUM ('encroachment','water_contamination','dead_fish','oil_spill','sewage','illegal_dumping','other');

-- ============== DISTRICTS ==============
CREATE TABLE public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "districts readable by all authenticated" ON public.districts FOR SELECT TO authenticated USING (true);

-- ============== WATER BODIES ==============
CREATE TABLE public.water_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  risk_level public.complaint_severity NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.water_bodies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_water_bodies_district ON public.water_bodies(district_id);
CREATE POLICY "water bodies readable by all authenticated" ON public.water_bodies FOR SELECT TO authenticated USING (true);

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  avatar_url TEXT,
  on_duty BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_district(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT district_id FROM public.profiles WHERE id = _user_id
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'officer'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== COMPLAINTS ==============
CREATE SEQUENCE public.complaint_code_seq START 1;

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT ('CMP-' || lpad(nextval('public.complaint_code_seq')::text, 4, '0')),
  citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  water_body_id UUID NOT NULL REFERENCES public.water_bodies(id),
  district_id UUID NOT NULL REFERENCES public.districts(id),
  type public.complaint_type NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  severity public.complaint_severity NOT NULL DEFAULT 'medium',
  status public.complaint_status NOT NULL DEFAULT 'submitted',
  assigned_officer_id UUID REFERENCES auth.users(id),
  sla_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolution_photo_url TEXT,
  reinvestigation_count INT NOT NULL DEFAULT 0,
  reinvestigation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_complaints_district ON public.complaints(district_id);
CREATE INDEX idx_complaints_citizen ON public.complaints(citizen_id);
CREATE INDEX idx_complaints_officer ON public.complaints(assigned_officer_id);
CREATE INDEX idx_complaints_status ON public.complaints(status);

CREATE POLICY "citizens read own complaints" ON public.complaints FOR SELECT TO authenticated USING (citizen_id = auth.uid());
CREATE POLICY "officers read district complaints" ON public.complaints FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'officer') AND district_id = public.get_user_district(auth.uid()));
CREATE POLICY "admins read all complaints" ON public.complaints FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "citizens insert complaints" ON public.complaints FOR INSERT TO authenticated WITH CHECK (citizen_id = auth.uid() AND public.has_role(auth.uid(),'citizen'));
CREATE POLICY "officers update district complaints" ON public.complaints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'officer') AND district_id = public.get_user_district(auth.uid())) WITH CHECK (public.has_role(auth.uid(),'officer') AND district_id = public.get_user_district(auth.uid()));
CREATE POLICY "citizens reinvestigate own" ON public.complaints FOR UPDATE TO authenticated USING (citizen_id = auth.uid()) WITH CHECK (citizen_id = auth.uid());
CREATE POLICY "admins update all complaints" ON public.complaints FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== COMPLAINT EVENTS ==============
CREATE TABLE public.complaint_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_events_complaint ON public.complaint_events(complaint_id);

CREATE POLICY "events readable if complaint readable" ON public.complaint_events FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND (
    c.citizen_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'officer') AND c.district_id = public.get_user_district(auth.uid()))
  ))
);
CREATE POLICY "auth users insert events" ON public.complaint_events FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- ============== NOTIFICATIONS ==============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE POLICY "users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============== TRIGGERS ==============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_complaints_touch BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile + default citizen role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
  v_district UUID;
  v_district_name TEXT;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'citizen');
  v_district_name := NEW.raw_user_meta_data->>'district';
  IF v_district_name IS NOT NULL THEN
    SELECT id INTO v_district FROM public.districts WHERE name = v_district_name LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, phone, district_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'phone', v_district);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Log "submitted" event automatically
CREATE OR REPLACE FUNCTION public.log_complaint_insert() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
  VALUES (NEW.id, NEW.citizen_id, 'submitted', 'Complaint filed');
  -- Notify admins
  INSERT INTO public.notifications(user_id, complaint_id, title, body)
  SELECT ur.user_id, NEW.id, 'New complaint ' || NEW.code, NEW.type::text || ' reported'
  FROM public.user_roles ur WHERE ur.role = 'admin';
  -- Notify officers in district
  INSERT INTO public.notifications(user_id, complaint_id, title, body)
  SELECT p.id, NEW.id, 'New complaint ' || NEW.code || ' in your district', NEW.type::text
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role='officer' AND p.district_id = NEW.district_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_complaint_inserted AFTER INSERT ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.log_complaint_insert();

-- Status change notifications + auto-resolve timestamp
CREATE OR REPLACE FUNCTION public.log_complaint_update() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO public.complaint_events(complaint_id, actor_id, action, notes)
    VALUES (NEW.id, auth.uid(), 'status_changed', OLD.status::text || ' -> ' || NEW.status::text);
    INSERT INTO public.notifications(user_id, complaint_id, title, body)
    VALUES (NEW.citizen_id, NEW.id, 'Complaint ' || NEW.code || ' updated', 'Status: ' || NEW.status::text);
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_complaint_updated BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.log_complaint_update();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER TABLE public.complaint_events REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Storage bucket for complaint photos
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-photos','complaint-photos', true);

CREATE POLICY "complaint photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'complaint-photos');
CREATE POLICY "auth upload complaint photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'complaint-photos');
CREATE POLICY "auth update own complaint photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'complaint-photos' AND owner = auth.uid());
