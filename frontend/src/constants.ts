import { Utensils, Droplets, ShoppingCart, Sparkles, Shirt, Box } from 'lucide-react';
import type { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cooking',  name: '料理',   icon: Utensils,     color: 'bg-brand-rose/50' },
  { id: 'cleaning', name: '掃除',   icon: Sparkles,     color: 'bg-sky-200' },
  { id: 'laundry',  name: '洗濯',   icon: Shirt,        color: 'bg-indigo-100' },
  { id: 'water',    name: '水回り', icon: Droplets,     color: 'bg-brand-teal/30' },
  { id: 'shopping', name: '買物',   icon: ShoppingCart, color: 'bg-brand-green/25' },
  { id: 'other',    name: 'その他', icon: Box,          color: 'bg-stone-200' },
];
