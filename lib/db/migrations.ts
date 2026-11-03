export type Migration = {
  version: number;
  name: string;
  statements: string[];
};

const initialSchema: string[] = [
  `CREATE TABLE IF NOT EXISTS vk_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password boolean NOT NULL DEFAULT false,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vk_users_username_lower_uq ON vk_users (lower(username))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vk_users_email_lower_uq ON vk_users (lower(email))`,

  `CREATE TABLE IF NOT EXISTS vk_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES vk_users(id) ON DELETE CASCADE,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS vk_sessions_user_id_idx ON vk_sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS vk_sessions_expires_at_idx ON vk_sessions (expires_at)`,

  `CREATE TABLE IF NOT EXISTS vk_app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS vk_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    color text NOT NULL DEFAULT 'blue',
    owner_id uuid NOT NULL REFERENCES vk_users(id) ON DELETE RESTRICT,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vk_projects_owner_id_idx ON vk_projects (owner_id)`,
  `CREATE INDEX IF NOT EXISTS vk_projects_archived_at_idx ON vk_projects (archived_at)`,

  `CREATE TABLE IF NOT EXISTS vk_project_members (
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES vk_users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vk_project_members_one_owner_uq ON vk_project_members (project_id) WHERE role = 'owner'`,
  `CREATE INDEX IF NOT EXISTS vk_project_members_user_id_idx ON vk_project_members (user_id)`,

  `CREATE TABLE IF NOT EXISTS vk_columns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    position integer NOT NULL,
    wip_limit integer CHECK (wip_limit IS NULL OR wip_limit > 0),
    history_window_days integer CHECK (history_window_days IS NULL OR history_window_days > 0),
    is_done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vk_columns_project_position_idx ON vk_columns (project_id, position)`,
  `CREATE INDEX IF NOT EXISTS vk_columns_project_done_idx ON vk_columns (project_id, is_done)`,

  `CREATE TABLE IF NOT EXISTS vk_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    column_id uuid REFERENCES vk_columns(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    position integer NOT NULL,
    priority text NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
    due_at timestamptz,
    column_entered_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    created_by uuid REFERENCES vk_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vk_cards_column_position_idx ON vk_cards (column_id, position)`,
  `CREATE INDEX IF NOT EXISTS vk_cards_project_archived_idx ON vk_cards (project_id, archived_at)`,
  `CREATE INDEX IF NOT EXISTS vk_cards_project_due_idx ON vk_cards (project_id, due_at)`,
  `CREATE INDEX IF NOT EXISTS vk_cards_column_entered_idx ON vk_cards (column_id, column_entered_at)`,
  `CREATE INDEX IF NOT EXISTS vk_cards_project_priority_idx ON vk_cards (project_id, priority)`,

  `CREATE TABLE IF NOT EXISTS vk_labels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL DEFAULT 'slate',
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vk_labels_project_name_uq ON vk_labels (project_id, lower(name))`,
  `CREATE INDEX IF NOT EXISTS vk_labels_project_position_idx ON vk_labels (project_id, position)`,

  `CREATE TABLE IF NOT EXISTS vk_card_labels (
    card_id uuid NOT NULL REFERENCES vk_cards(id) ON DELETE CASCADE,
    label_id uuid NOT NULL REFERENCES vk_labels(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, label_id)
  )`,
  `CREATE INDEX IF NOT EXISTS vk_card_labels_label_id_idx ON vk_card_labels (label_id)`,

  `CREATE TABLE IF NOT EXISTS vk_card_assignees (
    card_id uuid NOT NULL REFERENCES vk_cards(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES vk_users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS vk_card_assignees_user_id_idx ON vk_card_assignees (user_id)`,

  `CREATE TABLE IF NOT EXISTS vk_custom_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('text', 'long_text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'user')),
    options jsonb NOT NULL DEFAULT '[]',
    position integer NOT NULL,
    show_on_card boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vk_custom_fields_project_name_uq ON vk_custom_fields (project_id, lower(name))`,
  `CREATE INDEX IF NOT EXISTS vk_custom_fields_project_position_idx ON vk_custom_fields (project_id, position)`,

  `CREATE TABLE IF NOT EXISTS vk_card_field_values (
    card_id uuid NOT NULL REFERENCES vk_cards(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES vk_custom_fields(id) ON DELETE CASCADE,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, field_id)
  )`,
  `CREATE INDEX IF NOT EXISTS vk_card_field_values_field_id_idx ON vk_card_field_values (field_id)`,

  `CREATE TABLE IF NOT EXISTS vk_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id uuid NOT NULL REFERENCES vk_cards(id) ON DELETE CASCADE,
    user_id uuid REFERENCES vk_users(id) ON DELETE SET NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS vk_comments_card_created_idx ON vk_comments (card_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS vk_comments_user_id_idx ON vk_comments (user_id)`,

  `CREATE TABLE IF NOT EXISTS vk_activities (
    id bigserial PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    card_id uuid REFERENCES vk_cards(id) ON DELETE CASCADE,
    user_id uuid REFERENCES vk_users(id) ON DELETE SET NULL,
    type text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vk_activities_project_created_idx ON vk_activities (project_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vk_activities_card_created_idx ON vk_activities (card_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS vk_automations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    trigger_type text NOT NULL CHECK (trigger_type IN ('card.created', 'card.moved', 'card.updated', 'card.due_soon', 'card.overdue', 'card.stale_in_column')),
    trigger_config jsonb NOT NULL DEFAULT '{}',
    conditions jsonb NOT NULL DEFAULT '[]',
    actions jsonb NOT NULL DEFAULT '[]',
    created_by uuid REFERENCES vk_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vk_automations_project_enabled_idx ON vk_automations (project_id, enabled)`,
  `CREATE INDEX IF NOT EXISTS vk_automations_trigger_type_idx ON vk_automations (trigger_type)`,

  `CREATE TABLE IF NOT EXISTS vk_automation_runs (
    id bigserial PRIMARY KEY,
    automation_id uuid NOT NULL REFERENCES vk_automations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES vk_projects(id) ON DELETE CASCADE,
    card_id uuid REFERENCES vk_cards(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('success', 'skipped', 'error')),
    message text NOT NULL DEFAULT '',
    dedupe_key text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vk_automation_runs_dedupe_uq ON vk_automation_runs (automation_id, dedupe_key) WHERE dedupe_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS vk_automation_runs_automation_created_idx ON vk_automation_runs (automation_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vk_automation_runs_project_created_idx ON vk_automation_runs (project_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vk_automation_runs_card_id_idx ON vk_automation_runs (card_id)`,

  `CREATE TABLE IF NOT EXISTS vk_schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE OR REPLACE FUNCTION vk_set_updated_at()
   RETURNS trigger AS $$
   BEGIN
     NEW.updated_at = now();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  `CREATE OR REPLACE FUNCTION vk_cards_before_update()
   RETURNS trigger AS $$
   BEGIN
     IF NEW.column_id IS DISTINCT FROM OLD.column_id THEN
       NEW.column_entered_at = now();
     END IF;
     NEW.updated_at = now();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS vk_users_set_updated_at ON vk_users`,
  `CREATE TRIGGER vk_users_set_updated_at BEFORE UPDATE ON vk_users FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_app_settings_set_updated_at ON vk_app_settings`,
  `CREATE TRIGGER vk_app_settings_set_updated_at BEFORE UPDATE ON vk_app_settings FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_projects_set_updated_at ON vk_projects`,
  `CREATE TRIGGER vk_projects_set_updated_at BEFORE UPDATE ON vk_projects FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_columns_set_updated_at ON vk_columns`,
  `CREATE TRIGGER vk_columns_set_updated_at BEFORE UPDATE ON vk_columns FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_labels_set_updated_at ON vk_labels`,
  `CREATE TRIGGER vk_labels_set_updated_at BEFORE UPDATE ON vk_labels FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_custom_fields_set_updated_at ON vk_custom_fields`,
  `CREATE TRIGGER vk_custom_fields_set_updated_at BEFORE UPDATE ON vk_custom_fields FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_card_field_values_set_updated_at ON vk_card_field_values`,
  `CREATE TRIGGER vk_card_field_values_set_updated_at BEFORE UPDATE ON vk_card_field_values FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_comments_set_updated_at ON vk_comments`,
  `CREATE TRIGGER vk_comments_set_updated_at BEFORE UPDATE ON vk_comments FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_automations_set_updated_at ON vk_automations`,
  `CREATE TRIGGER vk_automations_set_updated_at BEFORE UPDATE ON vk_automations FOR EACH ROW EXECUTE FUNCTION vk_set_updated_at()`,
  `DROP TRIGGER IF EXISTS vk_cards_set_column_entered_at ON vk_cards`,
  `CREATE TRIGGER vk_cards_set_column_entered_at BEFORE UPDATE ON vk_cards FOR EACH ROW EXECUTE FUNCTION vk_cards_before_update()`,

  `INSERT INTO vk_app_settings (key, value)
   VALUES
     ('site_name', '"Kanban"'::jsonb),
     ('allow_registration', 'false'::jsonb)
   ON CONFLICT (key) DO NOTHING`,
];

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    statements: initialSchema,
  },
];
