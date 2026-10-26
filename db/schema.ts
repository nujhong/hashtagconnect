import { index, integer, primaryKey, sqliteTable, text } from "void/schema-d1";

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  profileUrl: text("profile_url").notNull().unique(),
  confirmedBy: text("confirmed_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  addedAt: integer("added_at").notNull(),
  pooledAt: integer("pooled_at"),
  personId: text("person_id").references(() => people.id, { onDelete: "set null" }),
}, (table) => [index("posts_pool").on(table.pooledAt)]);

export const personStates = sqliteTable("person_states", {
  userId: text("user_id").notNull(),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  sourcePostId: text("source_post_id").references(() => posts.id, { onDelete: "set null" }),
  choice: text("choice", { enum: ["save", "skip"] }),
  openedAt: integer("opened_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.personId] })]);

export const postStates = sqliteTable("post_states", {
  userId: text("user_id").notNull(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  choice: text("choice", { enum: ["save", "skip"] }),
  openedAt: integer("opened_at"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.postId] })]);

export const scanUsage = sqliteTable("scan_usage", {
  day: text("day").primaryKey(),
  attempts: integer("attempts").notNull(),
});
