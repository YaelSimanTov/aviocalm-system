import React, { useState } from 'react';
import { CheckCircle, X, Copy, Check } from 'lucide-react';

const PasswordResetModal = ({ isOpen, data, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const copyToClipboard = () => {
    const text = `Username: ${data.username}\nTemp Password: ${data.temporaryPassword || data.tempPassword}`;
    navigator.clipboard.writeText(text);
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative animate-in zoom-in duration-200">
        
        {/* Floating "Copied!" confirmation toast */}
        {copied && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
            <Check size={14} className="text-green-400" /> Copied to clipboard!
          </div>
        )}

        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
            <CheckCircle className="h-10 w-10 text-blue-600" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Password Reset!</h3>
          <p className="text-slate-500 text-sm mb-6">The password has been updated. Please send the new credentials to the therapist manually.</p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left relative group border border-slate-100">
            {/* Inline copy icon in the top-right corner */}
            <button 
              onClick={copyToClipboard}
              className="absolute top-3 right-3 text-slate-400 hover:text-blue-600 transition-colors"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>

            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Credentials</span>
            <div className="space-y-1">
              <p className="text-sm text-slate-700"><strong>Username:</strong> {data.username}</p>
              <p className="text-sm text-slate-700"><strong>Temp Password:</strong> <span className="font-mono font-bold text-blue-600">{data.temporaryPassword || data.tempPassword}</span></p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetModal;