import type { LucideIcon } from 'lucide-react';

export interface User {
  id: string;
  name: string;
  color: string;
  today: number;
  total: number;
}

export interface Task {
  id: string;
  name: string;
  points: number;
  categoryId: string;
}

export interface HistoryItem {
  id: string;
  taskId: string;
  taskName: string;
  points: number;
  categoryId: string;
  userId: string;
  timestamp: Date;
}

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}
