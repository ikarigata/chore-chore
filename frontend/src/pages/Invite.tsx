import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { flatBorder, bounceClass } from '../styles';

export default function Invite() {
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = () => {
    setIsJoining(true);
    setTimeout(() => {
      alert('Cognitoのサインアップ画面へ遷移します (モック)');
      setIsJoining(false);
      navigate('/');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-6 text-stone-800">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-8 ${flatBorder} shadow-[8px_8px_0px_#292524] text-center relative`}>
        <button
          onClick={() => navigate(-1)}
          className={`absolute top-4 left-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-20 h-20 bg-yellow-200 rounded-full border-4 border-stone-800 mx-auto mb-6 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-stone-800" />
        </div>

        <h1 className="text-2xl font-black mb-2">ieziへようこそ！</h1>
        <p className="font-bold text-stone-600 mb-8 leading-relaxed">
          <span className="text-teal-600 border-b-2 border-teal-200">パパさん</span> から招待が届いています。
          <br />一緒に家事管理を始めましょう！
        </p>

        <button
          onClick={handleJoin}
          disabled={isJoining}
          className={`w-full bg-teal-400 py-4 rounded-xl font-black text-lg border-2 border-stone-800 shadow-[0px_4px_0px_#292524] active:shadow-[0px_0px_0px_#292524] active:translate-y-1 transition-all flex items-center justify-center gap-2`}
        >
          {isJoining ? <Loader2 className="w-6 h-6 animate-spin" /> : '参加して、はじめる'}
        </button>

        <div className="mt-6 text-xs font-bold text-stone-400 underline decoration-stone-300 underline-offset-4">
          すでにアカウントをお持ちの方はこちら
        </div>
      </div>
    </div>
  );
}
