import { z } from 'zod';

// --- Domain Models ---

export const UserSchema = z.object({
  cognitoSub: z.string(),
  displayName: z.string(),
  totalPoints: z.number(),
  neguraiPoints: z.number().optional(),
  icon: z.string().max(8).optional(),
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

export const NeguraiSchema = z.object({
  neguraiId: z.string(),
  giverSub: z.string(),
  receiverSub: z.string(),
  description: z.string(),
  points: z.number(),
  timestamp: z.string(),
  expiresAt: z.number(),
});

export type User = z.infer<typeof UserSchema>;
export type TaskMaster = z.infer<typeof TaskMasterSchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;
export type TaskHistory = z.infer<typeof TaskHistorySchema>;
export type Negurai = z.infer<typeof NeguraiSchema>;

// --- API Request/Response Schemas ---

export const FamilyInitResponseSchema = z.object({
  users: z.array(UserSchema),
  taskMasters: z.array(TaskMasterSchema),
});

export const SummaryDailyResponseSchema = z.object({
  date: z.string(),
  summaries: z.array(DailySummarySchema),
});

export const SummaryWeeklyResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
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
  timestamp: z.string().datetime().optional(),
});

export const TaskHistoryDeleteRequestSchema = z.object({
  taskExecutionId: z.string(),
  timestamp: z.string(),
  points: z.number(),
});

export const NeguraiCreateRequestSchema = z.object({
  neguraiId: z.string().uuid(),
  giverSub: z.string().min(1),
  description: z.string().min(1),
  points: z.number().int().positive(),
});

export const NeguraiDeleteRequestSchema = z.object({
  neguraiId: z.string().uuid(),
  timestamp: z.string(),
  points: z.number().int().positive(),
  giverSub: z.string().min(1),
});

export const NeguraiListResponseSchema = z.object({
  negurai: z.array(NeguraiSchema),
})

export const MemoSchema = z.object({
  memoId: z.string(),
  authorSub: z.string(),
  content: z.string(),
  timestamp: z.string(),
  expiresAt: z.number(),
})

export const MemoCreateRequestSchema = z.object({
  memoId: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
})

export const MemoDeleteRequestSchema = z.object({
  memoId: z.string().uuid(),
  timestamp: z.string(),
})

export const MemoListResponseSchema = z.object({
  memos: z.array(MemoSchema),
});

export const UserUpdateRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    icon: z.string().max(8).optional(),
  })
  .refine(v => v.displayName !== undefined || v.icon !== undefined, {
    message: 'displayName または icon のいずれかを指定してください',
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
export type SummaryWeeklyResponse = z.infer<typeof SummaryWeeklyResponseSchema>;
export type TaskHistoryListResponse = z.infer<typeof TaskHistoryListResponseSchema>;
export type TaskMasterUpsertRequest = z.infer<typeof TaskMasterUpsertRequestSchema>;
export type TaskHistoryCreateRequest = z.infer<typeof TaskHistoryCreateRequestSchema>;
export type TaskHistoryDeleteRequest = z.infer<typeof TaskHistoryDeleteRequestSchema>;
export type NeguraiCreateRequest = z.infer<typeof NeguraiCreateRequestSchema>;
export type NeguraiDeleteRequest = z.infer<typeof NeguraiDeleteRequestSchema>;
export type NeguraiListResponse = z.infer<typeof NeguraiListResponseSchema>;
export type Memo = z.infer<typeof MemoSchema>;
export type MemoCreateRequest = z.infer<typeof MemoCreateRequestSchema>;
export type MemoDeleteRequest = z.infer<typeof MemoDeleteRequestSchema>;
export type MemoListResponse = z.infer<typeof MemoListResponseSchema>;
export type UserUpdateRequest = z.infer<typeof UserUpdateRequestSchema>;
export type FamilyCreateRequest = z.infer<typeof FamilyCreateRequestSchema>;
export type FamilyJoinRequest = z.infer<typeof FamilyJoinRequestSchema>;
export type FamilyCreateResponse = z.infer<typeof FamilyCreateResponseSchema>;
export type FamilyInviteResponse = z.infer<typeof FamilyInviteResponseSchema>;
export type FamilyJoinResponse = z.infer<typeof FamilyJoinResponseSchema>;
