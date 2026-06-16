import React, { useEffect, useState } from 'react';

const EditTherapistModal = ({ isOpen, therapist, onClose, onSave }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  const cleanNameInput = (value) => {
    return value.replace(/[0-9]/g, '');
  };

  useEffect(() => {
    if (isOpen && therapist) {
      setFirstName(cleanNameInput(therapist.first_name || therapist.firstName || ''));
      setLastName(cleanNameInput(therapist.last_name || therapist.lastName || ''));
      setError('');
    }
  }, [isOpen, therapist]);

  if (!isOpen || !therapist) {
    return null;
  }

  const handleSave = () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanFirstName || !cleanLastName) {
      setError('First name and last name cannot be empty.');
      return;
    }

    const nameRegex = /^[\p{L}\s'-]+$/u;

    if (!nameRegex.test(cleanFirstName) || !nameRegex.test(cleanLastName)) {
      setError('First name and last name can contain letters only.');
      return;
    }

    onSave(therapist.username, {
      firstName: cleanFirstName,
      lastName: cleanLastName
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-3xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold mb-6">Edit Therapist Name</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-4">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="block font-semibold mb-2">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(cleanNameInput(e.target.value));
              if (error) setError('');
            }}
            className="w-full border rounded-lg px-4 py-3"
          />
        </div>

        <div className="mb-8">
          <label className="block font-semibold mb-2">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => {
              setLastName(cleanNameInput(e.target.value));
              if (error) setError('');
            }}
            className="w-full border rounded-lg px-4 py-3"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default EditTherapistModal;