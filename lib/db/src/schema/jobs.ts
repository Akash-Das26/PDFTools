import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  tool: text("tool").notNull(),
  originalFilename: text("original_filename").notNull(),
  inputSizeBytes: integer("input_size_bytes").notNull().default(0),
  outputSizeBytes: integer("output_size_bytes"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
