import type { LucideIcon } from 'lucide-react';
import { springStyle } from '../styles';

interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function NavButton({ icon: Icon, label, active, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-300 ${active ? 'scale-110' : 'active:scale-95'}`}
      style={springStyle}
    >
      <div className={`relative p-1.5 rounded-lg ${active ? 'bg-yellow-200 border-2 border-stone-800' : 'text-stone-500'}`}>
        <Icon className={active ? 'w-5 h-5 text-stone-800' : 'w-6 h-6'} />
        {active && <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-teal-400 rounded-full border border-stone-800"></div>}
      </div>
      <span className={`text-[10px] mt-1 font-bold ${active ? 'text-stone-800' : 'text-stone-500'}`}>{label}</span>
    </button>
  );
}
