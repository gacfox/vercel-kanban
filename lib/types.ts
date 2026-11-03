export type GlobalRole = "admin" | "user";

export type ProjectRole = "owner" | "editor" | "viewer";

export type Priority = "none" | "low" | "medium" | "high" | "urgent";

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "user";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type UserSummary = {
  id: string;
  username: string;
  displayName: string;
};

export type SessionUser = UserSummary & {
  email: string;
  role: GlobalRole;
  mustChangePassword: boolean;
  createdAt: string;
  sessionId?: string;
};

export type AdminUser = SessionUser & {
  status: "active" | "disabled";
  lastLoginAt: string | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: ProjectRole;
  isAdmin: boolean;
  memberCount: number;
  totalCards: number;
  doneCards: number;
  overdueCards: number;
  dueSoonCards: number;
  members: UserSummary[];
};

export type BoardProject = {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerId: string;
  archivedAt: string | null;
  updatedAt: string;
};

export type BoardColumn = {
  id: string;
  projectId: string;
  title: string;
  position: number;
  wipLimit: number | null;
  historyWindowDays: number | null;
  isDone: boolean;
  visibleCount: number;
  totalCount: number;
  hiddenCount: number;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  position: number;
};

export type CustomField = {
  id: string;
  name: string;
  type: FieldType;
  options: string[];
  position: number;
  showOnCard: boolean;
};

export type ProjectMember = {
  user: UserSummary & { email?: string };
  role: ProjectRole;
  createdAt: string;
};

export type BoardCard = {
  id: string;
  projectId: string;
  columnId: string | null;
  title: string;
  description: string;
  position: number;
  priority: Priority;
  dueAt: string | null;
  columnEnteredAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  labels: Label[];
  assignees: UserSummary[];
  fieldValues: Record<string, unknown>;
  commentCount: number;
};

export type Comment = {
  id: string;
  body: string;
  user: UserSummary | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Activity = {
  id: number;
  type: string;
  data: Record<string, unknown>;
  user: UserSummary | null;
  createdAt: string;
};

export type CardDetail = {
  card: BoardCard;
  comments: Comment[];
  activities: Activity[];
};

export type ArchivedCard = BoardCard & {
  columnTitle: string | null;
};

export type BoardData = {
  project: BoardProject;
  columns: BoardColumn[];
  cards: BoardCard[];
  labels: Label[];
  fields: CustomField[];
  members: ProjectMember[];
  role: ProjectRole;
  isAdmin: boolean;
  canEdit: boolean;
  canManage: boolean;
  snapshotRevision: string;
  currentUser: SessionUser;
};

export type ProjectSettingsData = {
  project: BoardProject;
  members: ProjectMember[];
  columns: BoardColumn[];
  labels: Label[];
  fields: CustomField[];
  role: ProjectRole;
  isAdmin: boolean;
  canManage: boolean;
};

export type MyTask = {
  cardId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  columnId: string;
  columnTitle: string;
  title: string;
  priority: Priority;
  dueAt: string | null;
};

export type ColumnHistoryResult = {
  cards: BoardCard[];
  hasMore: boolean;
};
