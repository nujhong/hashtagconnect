import type { ProjectProfile, ProjectImport } from "~/src/project-profile";
import type { ScanResult } from "~/src/scan-contract";
import { index, integer, primaryKey, sqliteTable, text } from "void/schema-d1";

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  profileUrl: text("profile_url").notNull().unique(),
  confirmedBy: text("confirmed_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    addedAt: integer("added_at").notNull(),
    pooledAt: integer("pooled_at"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    personId: text("person_id").references(() => people.id, { onDelete: "set null" }),
  },
  (table) => [index("posts_pool").on(table.pooledAt)],
);

export const personStates = sqliteTable(
  "person_states",
  {
    userId: text("user_id").notNull(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    sourcePostId: text("source_post_id").references(() => posts.id, { onDelete: "set null" }),
    choice: text("choice", { enum: ["save", "skip"] }),
    openedAt: integer("opened_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.personId] })],
);

export const postStates = sqliteTable(
  "post_states",
  {
    userId: text("user_id").notNull(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    choice: text("choice", { enum: ["save", "skip"] }),
    openedAt: integer("opened_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.postId] })],
);

/** Optional context is separate from the provider-owned OAuth bio. */
export const viewerContext = sqliteTable("viewer_context", {
  userId: text("user_id").primaryKey(),
  sentence: text("sentence").notNull(),
  project: text("project", { mode: "json" }).$type<ProjectProfile>(),
  projectImport: text("project_import", { mode: "json" }).$type<ProjectImport>(),
});

/** First-party milestones, not a log of profiles viewed or confirmed connections. */
export const funnel = sqliteTable("funnel", {
  userId: text("user_id").primaryKey(),
  firstKeepAt: integer("first_keep_at"),
  firstOpenAt: integer("first_open_at"),
  firstVisitDay: text("first_visit_day"),
  lastVisitDay: text("last_visit_day"),
  activeDays: integer("active_days").notNull().default(0),
  feedback: integer("feedback", { mode: "boolean" }),
});

/** At most one result per viewer/post; the hash includes every inference input and rubric version. */
export const scanCache = sqliteTable(
  "scan_cache",
  {
    userId: text("user_id").notNull(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    inputHash: text("input_hash").notNull(),
    result: text("result", { mode: "json" }).$type<ScanResult>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.postId] })],
);
