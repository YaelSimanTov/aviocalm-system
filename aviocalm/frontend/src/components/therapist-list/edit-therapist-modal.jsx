import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const EditTherapistModal = ({ isOpen, therapist, onClose, onSave }) => {
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error,       setError]       = useState('');

  // Only allow letters, spaces, hyphens and apostrophes in name fields
  const cleanNameInput = (value) => value.replace(/[0-9]/g, '');

  // Seed form fields whenever the modal opens or the target therapist changes
  useEffect(() => {
    if (isOpen && therapist) {
      setFirstName(cleanNameInput(therapist.first_name   || therapist.firstName   || ''));
      setLastName(cleanNameInput(therapist.last_name    || therapist.lastName    || ''));
      setEmail(therapist.email        || '');
      setPhoneNumber(therapist.phone_number || therapist.phoneNumber || '');
      setError('');
    }
  }, [isOpen, therapist]);

  if (!isOpen || !therapist) return null;

  const handleSave = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName  = lastName.trim();
    const cleanEmail     = email.trim().toLowerCase();
    const cleanPhone     = phoneNumber.trim();

    // Name validation
    if (!cleanFirstName || !cleanLastName) {
      setError('First name and last name cannot be empty.');
      return;
    }
    const nameRegex = /^[\p{L}\s'-]+$/u;
    if (!nameRegex.test(cleanFirstName) || !nameRegex.test(cleanLastName)) {
      setError('Names can contain letters, spaces, hyphens and apostrophes only.');
      return;
    }

    // Email validation (when provided)
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    // Phone validation: strip non-numeric chars except leading '+', then check length 9–15
    if (cleanPhone) {
      const digits = cleanPhone.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) {
        setError('Phone number must contain 9–15 digits (a leading + is allowed).');
        return;
      }
    }

    // Delegate to the parent handler and surface any API error back inside this modal
    const result = await onSave(therapist.username, {
      firstName:   cleanFirstName,
      lastName:    cleanLastName,
      email:       cleanEmail  || null,
      phoneNumber: cleanPhone  || null,
    });

    if (result && !result.success) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 relative animate-in zoom-in duration-200">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Therapist Profile</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 mb-5 rounded-r-lg">
            {error}
          </div>
        )}

        {/* Username — read-only identifier, cannot be changed */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Username <span className="text-xs font-normal text-slate-400">(read-only)</span>
          </label>
          <input
            type="text"
            value={therapist.username}
            readOnly
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
          />
        </div>

        {/* First Name */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 mb-1">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => { setFirstName(cleanNameInput(e.target.value)); if (error) setError(''); }}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Last Name */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => { setLastName(cleanNameInput(e.target.value)); if (error) setError(''); }}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Email — optional */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Email <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            placeholder="therapist@example.com"
            autoComplete="email"
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Phone Number — optional */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Phone Number <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => { setPhoneNumber(e.target.value); if (error) setError(''); }}
            placeholder="+972501234567"
            autoComplete="tel"
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTherapistModal;