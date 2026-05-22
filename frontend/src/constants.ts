import { Utensils, Droplets, ShoppingCart, Sparkles, Shirt, Box } from 'lucide-react';
import type { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cooking', name: '料理', icon: Utensils, color: 'bg-red-100' },
  { id: 'cleaning', name: '掃除', icon: Sparkles, color: 'bg-blue-100' },
  { id: 'laundry', name: '洗濯', icon: Shirt, color: 'bg-cyan-100' },
  { id: 'water', name: '水回り', icon: Droplets, color: 'bg-teal-100' },
  { id: 'shopping', name: '買物', icon: ShoppingCart, color: 'bg-green-100' },
  { id: 'other', name: 'その他', icon: Box, color: 'bg-stone-100' },
];
