import React, { useState, useEffect } from 'react';
import { AlertTriangle, Users, X } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, therapist, otherTherapists = [], onClose, onConfirm }) => {
  const [selectedReplacementId, setSelectedReplacementId] = useState('');

  // Reset dropdown selection every time the modal opens
  useEffect(() => {
    if (isOpen) setSelectedReplacementId('');
  }, [isOpen]);

  if (!isOpen || !therapist) return null;

  const patientCount = Number(therapist.patient_count || 0);
  const hasPatients = patientCount > 0;
  const hasNoReplacement = hasPatients && otherTherapists.length === 0;
  const isConfirmDisabled = hasNoReplacement || (hasPatients && !selectedReplacementId);

  const handleConfirm = () => {
    onConfirm(hasPatients ? selectedReplacementId : null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Therapist?</h3>
          <p className="text-slate-600 mb-4 text-sm">
            Are you sure you want to permanently delete <strong>{therapist.username}</strong>?
            This action cannot be undone.
          </p>

          {hasPatients && (
            <div className="mb-6 text-left">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <Users size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This therapist has <strong>{patientCount}</strong> assigned patient{patientCount !== 1 ? 's' : ''}.
                  They must be reassigned to another therapist before deletion.
                </p>
              </div>

              {hasNoReplacement ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">
                    This therapist cannot be deleted because they have assigned patients and no other
                    therapists exist in the system. Please create another therapist first.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Reassign all patients to:
                  </label>
                  <select
                    value={selectedReplacementId}
                    onChange={(e) => setSelectedReplacementId(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white"
                  >
                    <option value="">— Select a replacement therapist —</option>
                    {otherTherapists.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.first_name} {t.last_name} (@{t.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;