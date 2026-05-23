import { useState } from 'react';
import { bounceClass, flatBorder, springStyle } from '../styles';

interface PointInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function PointInput({
  value,
  onChange,
  min = 5,
  max = 999,
  step = 5,
}: PointInputProps) {
  const [draft, setDraft] = useState<string>(String(value));

  const commit = (n: number) => {
    const clamped = Math.max(min, Math.min(max, n));
    setDraft(String(clamped));
    onChange(clamped);
  };

  const handleIncrement = () => commit(value + step);
  const handleDecrement = () => commit(value - step);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      onChange(val);
    }
  };

  const handleBlur = () => {
    const val = parseInt(draft, 10);
    if (isNaN(val) || val < min) {
      commit(min);
    } else if (val > max) {
      commit(max);
    } else {
      setDraft(String(val));
    }
  };

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className={`w-12 h-12 flex items-center justify-center bg-white ${flatBorder} rounded-full ${bounceClass} disabled:opacity-50 disabled:active:scale-100 shadow-[2px_2px_0px_#292524] hover:bg-stone-100`}
        style={springStyle}
        aria-label="数値を減らす"
      >
        <span className="text-stone-800 font-bold text-2xl leading-none mb-1">-</span>
      </button>

      <div className="relative flex items-center justify-center w-20">
        <input
          type="number"
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full text-center font-bold text-3xl text-stone-800 bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="absolute -bottom-1 text-xs font-bold text-stone-500">pt</span>
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className={`w-12 h-12 flex items-center justify-center bg-yellow-400 ${flatBorder} rounded-full ${bounceClass} disabled:opacity-50 disabled:active:scale-100 shadow-[2px_2px_0px_#292524] hover:bg-yellow-300`}
        style={springStyle}
        aria-label="数値を増やす"
      >
        <span className="text-stone-800 font-bold text-2xl leading-none mb-1">+</span>
      </button>
    </div>
  );
}
