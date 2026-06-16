import React from 'react';

const CreatedTherapistModal = ({ isOpen, data, onClose }) => {
  if (!isOpen || !data) {
    return null;
  }

  const username = data.username || data.therapist?.username || '';
  const temporaryPassword = data.temporaryPassword || '';

  const handleCopyCredentials = async () => {
    const credentials = `Username: ${username}\nPassword: ${temporaryPassword}`;

    try {
      await navigator.clipboard.writeText(credentials);
      alert('Credentials copied successfully');
    } catch (error) {
      console.error('Failed to copy credentials:', error);
      alert('Failed to copy credentials');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-3xl"
        >
          ×
        </button>

        <div className="text-center">
          <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-5xl">✓</span>
          </div>

          <h2 className="text-2xl font-bold mb-4">Therapist Created!</h2>

          <p className="text-gray-600 mb-6">
            Please provide these credentials to the therapist:
          </p>

          <div className="bg-gray-50 border rounded-2xl p-6 text-left mb-6">
            <p className="text-xs font-bold text-gray-400 mb-2">USERNAME</p>
            <p className="text-blue-600 font-bold text-lg mb-4">
              {username}
            </p>

            <p className="text-xs font-bold text-gray-400 mb-2">TEMPORARY PASSWORD</p>
            <p className="text-blue-600 font-bold text-lg">
              {temporaryPassword}
            </p>
          </div>

          <button
            onClick={handleCopyCredentials}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 py-4 rounded-2xl font-bold mb-3"
          >
            Copy Credentials
          </button>

          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatedTherapistModal;