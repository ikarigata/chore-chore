import { z } from 'zod';

// --- Domain Models ---

export const UserSchema = z.object({
  cognitoSub: z.string(),
  displayName: z.string(),
  totalPoints: z.number(),
});

export const TaskMasterSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  points: z.number(),
  categoryId: z.string().optional(),
});

export const DailySummarySchema = z.object({
  cognitoSub: z.string(),
  date: z.string(),
  dailyPoints: z.number(),
});

export const TaskHistorySchema = z.object({
  taskExecutionId: z.string(),
  cognitoSub: z.string(),
  taskId: z.string(),
  points: z.number(),
  timestamp: z.string(),
  expiresAt: z.number(),
});

export type User = z.infer<typeof UserSchema>;
export type TaskMaster = z.infer<typeof TaskMasterSchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;
export type TaskHistory = z.infer<typeof TaskHistorySchema>;

// --- API Request/Response Schemas ---

export const FamilyInitResponseSchema = z.object({
  users: z.array(UserSchema),
  taskMasters: z.array(TaskMasterSchema),
});

export const SummaryDailyResponseSchema = z.object({
  date: z.string(),
  summaries: z.array(DailySummarySchema),
});

export const TaskHistoryListResponseSchema = z.object({
  taskHistories: z.array(TaskHistorySchema),
});

export const TaskMasterUpsertRequestSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  points: z.number(),
  categoryId: z.string().optional(),
});

export const TaskHistoryCreateRequestSchema = z.object({
  taskId: z.string(),
  taskExecutionId: z.string(),
});

export const TaskHistoryDeleteRequestSchema = z.object({
  taskExecutionId: z.string(),
  timestamp: z.string(),
  points: z.number(),
});

export const FamilyCreateRequestSchema = z.object({
  displayName: z.string().min(1),
});

export const FamilyJoinRequestSchema = z.object({
  token: z.string().min(1),
  displayName: z.string().min(1),
});

export const FamilyCreateResponseSchema = z.object({
  familyId: z.string(),
});

export const FamilyInviteResponseSchema = z.object({
  token: z.string(),
  url: z.string().url(),
  expiresAt: z.number(),
});

export const FamilyJoinResponseSchema = z.object({
  familyId: z.string(),
});

export type FamilyInitResponse = z.infer<typeof FamilyInitResponseSchema>;
export type SummaryDailyResponse = z.infer<typeof SummaryDailyResponseSchema>;
export type TaskHistoryListResponse = z.infer<typeof TaskHistoryListResponseSchema>;
export type TaskMasterUpsertRequest = z.infer<typeof TaskMasterUpsertRequestSchema>;
export type TaskHistoryCreateRequest = z.infer<typeof TaskHistoryCreateRequestSchema>;
export type TaskHistoryDeleteRequest = z.infer<typeof TaskHistoryDeleteRequestSchema>;
export type FamilyCreateRequest = z.infer<typeof FamilyCreateRequestSchema>;
export type FamilyJoinRequest = z.infer<typeof FamilyJoinRequestSchema>;
export type FamilyCreateResponse = z.infer<typeof FamilyCreateResponseSchema>;
export type FamilyInviteResponse = z.infer<typeof FamilyInviteResponseSchema>;
export type FamilyJoinResponse = z.infer<typeof FamilyJoinResponseSchema>;
