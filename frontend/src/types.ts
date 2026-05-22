import type { LucideIcon } from 'lucide-react';

export interface User {
  cognitoSub: string;
  displayName: string;
  totalPoints: number;
  color: string; // assigned client-side for visual differentiation
}

export interface Task {
  taskId: string;
  taskName: string;
  points: number;
  categoryId: string; // frontend-only, not persisted to backend
}

export interface DailySummary {
  cognitoSub: string;
  date: string;
  dailyPoints: number;
}

export interface HistoryItem {
  taskExecutionId: string;
  cognitoSub: string;
  taskId: string;
  points: number;
  timestamp: string; // ISO 8601
}

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}
