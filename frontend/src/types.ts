import type { LucideIcon } from 'lucide-react';
import type { User as SharedUser, TaskMaster as SharedTaskMaster, DailySummary as SharedDailySummary, TaskHistory as SharedTaskHistory } from '@iezi/shared';

export interface User extends SharedUser {
  color: string; // assigned client-side for visual differentiation
}

export type TaskMaster = SharedTaskMaster;

export type DailySummary = SharedDailySummary;

export type TaskHistory = SharedTaskHistory;

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}
