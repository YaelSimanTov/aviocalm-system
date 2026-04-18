import React from 'react';
import { CheckCircle, X, Copy } from 'lucide-react';

const CreatedTherapistModal = ({ isOpen, data, onClose }) => {
    if (!isOpen || !data) return null;

    const copyToClipboard = () => {
        const text = `Username: ${data.username}\nPassword: ${data.temporaryPassword}`;
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative animate-in zoom-in duration-200">

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={20} />
                </button>

                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">Therapist Created!</h3>
                    <p className="text-slate-500 text-sm mb-6">Please provide these credentials to the therapist:</p>

                    <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-3 border border-slate-100">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Username</span>
                            <span className="text-slate-700 font-mono">{data.username}</span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Temporary Password</span>
                            <span className="text-blue-600 font-mono font-bold">{data.temporaryPassword}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={copyToClipboard}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 font-semibold rounded-xl hover:bg-blue-100 transition-all"
                        >
                            <Copy size={18} /> Copy Credentials
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreatedTherapistModal;