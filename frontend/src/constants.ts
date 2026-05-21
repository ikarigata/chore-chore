import { Utensils, Droplets, ShoppingCart, Sparkles, Shirt, Box } from 'lucide-react';
import type { Category, Task } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cooking', name: '料理', icon: Utensils, color: 'bg-red-100' },
  { id: 'cleaning', name: '掃除', icon: Sparkles, color: 'bg-blue-100' },
  { id: 'laundry', name: '洗濯', icon: Shirt, color: 'bg-cyan-100' },
  { id: 'water', name: '水回り', icon: Droplets, color: 'bg-teal-100' },
  { id: 'shopping', name: '買物', icon: ShoppingCart, color: 'bg-green-100' },
  { id: 'other', name: 'その他', icon: Box, color: 'bg-stone-100' },
];

export const INITIAL_TASKS: Task[] = [
  { id: 't1', name: '食器洗い', points: 10, categoryId: 'cooking' },
  { id: 't2', name: '夕食作り', points: 30, categoryId: 'cooking' },
  { id: 't3', name: 'お風呂掃除', points: 15, categoryId: 'water' },
  { id: 't4', name: 'トイレ掃除', points: 10, categoryId: 'water' },
  { id: 't5', name: '掃除機かけ', points: 15, categoryId: 'cleaning' },
  { id: 't6', name: '洗濯物を干す', points: 10, categoryId: 'laundry' },
  { id: 't7', name: '日用品の買出', points: 20, categoryId: 'shopping' },
];

export const GRAPH_BASE = [
  { day: '月', papa: 40, mama: 60 },
  { day: '火', papa: 50, mama: 80 },
  { day: '水', papa: 90, mama: 40 },
  { day: '木', papa: 30, mama: 70 },
  { day: '金', papa: 80, mama: 90 },
  { day: '土', papa: 120, mama: 100 },
];
