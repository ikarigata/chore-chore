import { Utensils, Droplets, ShoppingCart, Sparkles, Shirt, Box } from 'lucide-react';
import type { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cooking',  name: '料理',   icon: Utensils,     color: 'bg-rose-300' },
  { id: 'cleaning', name: '掃除',   icon: Sparkles,     color: 'bg-sky-300' },
  { id: 'laundry',  name: '洗濯',   icon: Shirt,        color: 'bg-indigo-300' },
  { id: 'water',    name: '水回り', icon: Droplets,     color: 'bg-teal-300' },
  { id: 'shopping', name: '買物',   icon: ShoppingCart, color: 'bg-green-300' },
  { id: 'other',    name: 'その他', icon: Box,          color: 'bg-stone-300' },
];

// ユーザーアイコン用の絵文字パレット（curated）
export const USER_ICONS: string[] = [
  '😀', '😎', '🥰', '🤓', '😴', '🤔',
  '🐱', '🐶', '🐰', '🦊', '🐼', '🐻',
  '🐯', '🦁', '🐧', '🐸', '🐙', '🦄',
  '🍎', '🍰', '🍩', '🍣', '🍕', '🍜',
  '🌸', '🌻', '🌈', '⭐', '🍀', '🔥',
  '👑', '🎮', '⚽', '🚀', '🎵', '✨',
];
