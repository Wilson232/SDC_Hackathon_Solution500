CREATE TABLE IF NOT EXISTS app_accounts (
  user_id text PRIMARY KEY,
  email text NOT NULL,
  persona text NOT NULL DEFAULT 'displaced_worker',
  app_role text NOT NULL DEFAULT 'member' CHECK (app_role IN ('member','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_bootstrap_grants (
  email text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_accounts(user_id),
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS certificate_plans (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_accounts(user_id),
  career_key text NOT NULL,
  career_title text NOT NULL,
  courses jsonb NOT NULL CHECK (jsonb_array_length(courses)=3),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected')),
  review_note text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text REFERENCES app_accounts(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,career_key)
);
CREATE TABLE IF NOT EXISTS certificate_files (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES certificate_plans(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  object_key text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL CHECK (size > 0 AND size <= 5242880),
  sha256 text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id,course_id),
  UNIQUE(plan_id,sha256)
);
CREATE TABLE IF NOT EXISTS certificate_reviews (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES certificate_plans(id),
  reviewer_id text NOT NULL REFERENCES app_accounts(user_id),
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS career_awards (
  plan_id uuid PRIMARY KEY REFERENCES certificate_plans(id),
  user_id text NOT NULL REFERENCES app_accounts(user_id),
  career_key text NOT NULL,
  career_title text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,career_key)
);
CREATE INDEX IF NOT EXISTS certificate_plans_review_queue ON certificate_plans(status,submitted_at);
CREATE TABLE IF NOT EXISTS certificate_notifications (
  id uuid PRIMARY KEY REFERENCES certificate_reviews(id),
  user_id text NOT NULL REFERENCES app_accounts(user_id),
  plan_id uuid NOT NULL REFERENCES certificate_plans(id),
  career_title text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS certificate_notifications_unread
  ON certificate_notifications(user_id,created_at DESC) WHERE read_at IS NULL;
