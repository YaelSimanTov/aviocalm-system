import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const EditTherapistModal = ({ isOpen, therapist, onClose, onSave }) => {
  const [formData, setFormData] = useState({ firstName: '', lastName: '' });

  useEffect(() => {
    if (therapist) {
      setFormData({ firstName: therapist.first_name, lastName: therapist.last_name });
    }
  }, [therapist]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><X /></button>
        <h3 className="text-xl font-bold mb-6">Edit Therapist Name</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
            <input 
              className="w-full p-2 border rounded-lg"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
            <input 
              className="w-full p-2 border rounded-lg"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            />
          </div>
          <button 
            onClick={() => onSave(therapist.username, formData)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-4"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTherapistModal;