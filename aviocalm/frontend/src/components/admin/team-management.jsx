import React from 'react';
import { Link } from 'react-router-dom';
import TherapistList from '../therapist-list/therapist-list';

export const TeamManagement = () => {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🛡️ Team Management</h1>

        <Link
          to="/admin/create-therapist"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          + Add Therapist
        </Link>
      </div>

      <TherapistList />
    </div>
  );
};

export default TeamManagement;