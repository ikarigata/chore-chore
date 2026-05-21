import { X, QrCode } from 'lucide-react';
import { flatBorder, bounceClass } from '../styles';

interface QrModalProps {
  onClose: () => void;
  onPreviewInvite: () => void;
}

export default function QrModal({ onClose, onPreviewInvite }: QrModalProps) {
  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-6 ${flatBorder} shadow-[8px_8px_0px_#292524] relative animate-in zoom-in-95 duration-200`}>
        <button onClick={onClose} className={`absolute top-4 right-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}>
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-black mb-6 text-center">家族を招待</h3>

        <div className={`w-48 h-48 mx-auto bg-stone-100 rounded-2xl ${flatBorder} flex items-center justify-center mb-6 relative`}>
          <QrCode className="w-24 h-24 text-stone-300" />
          <div className="absolute font-bold text-stone-400 rotate-12">QR Code Mock</div>
        </div>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            readOnly
            value="https://iezi.app/invite?token=abc..."
            className={`flex-1 p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold text-sm text-stone-500`}
          />
          <button className={`bg-stone-800 text-white px-4 rounded-xl font-bold border-2 border-stone-800 ${bounceClass}`}>
            コピー
          </button>
        </div>

        <div className="border-t-2 border-dashed border-stone-200 pt-4 text-center">
          <button
            onClick={onPreviewInvite}
            className="text-xs font-bold text-teal-600 bg-teal-50 px-4 py-2 rounded-full border border-teal-200"
          >
            ※招待された側の画面プレビューを見る
          </button>
        </div>
      </div>
    </div>
  );
}
