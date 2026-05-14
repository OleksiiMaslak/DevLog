import { z } from "zod";

export const publicStatusSchema = z.enum(["todo", "in-progress", "done"]);
export const publicPrioritySchema = z.enum(["low", "medium", "high"]);

export const priorityRank: Record<z.infer<typeof publicPrioritySchema>, number> = { high: 0, medium: 1, low: 2 };

export const titleField = z.string().trim().min(2).max(120);
export const descriptionField = z.string().trim().min(4).max(2000);
const notesField = z.string().trim().max(3000).optional().nullable();
const parentIdField = z.string().trim().min(1).optional().nullable();

export const taskCreateSchema = z.object({
  title: titleField,
  description: descriptionField,
  status: publicStatusSchema.default("todo"),
  priority: publicPrioritySchema.default("medium"),
  notes: notesField,
  parentId: parentIdField,
});

export const taskUpdateSchema = z.object({
  title: titleField.optional(),
  description: descriptionField.optional(),
  status: publicStatusSchema.optional(),
  priority: publicPrioritySchema.optional(),
  notes: notesField,
  parentId: parentIdField,
});

export const taskQuerySchema = z.object({
  status: z.union([publicStatusSchema, z.literal("all")]).default("all"),
  sort: z.enum(["priority", "date"]).default("priority"),
});

export const decomposeRequestSchema = z.object({
  taskId: z.string().trim().min(1),
  createSubtasks: z.boolean().default(false),
  answers: z.array(z.string().trim().min(1)).optional(),
});

export const statusUpdateRequestSchema = z.object({
  taskId: z.string().trim().min(1),
  audience: z.enum(["team", "lead", "standup"]).default("team"),
});

export type PublicStatus = z.infer<typeof publicStatusSchema>;
export type PublicPriority = z.infer<typeof publicPrioritySchema>;

export const statusOptions: Array<PublicStatus | "all"> = ["all", "todo", "in-progress", "done"];
export const priorityOptions: PublicPriority[] = ["low", "medium", "high"];
