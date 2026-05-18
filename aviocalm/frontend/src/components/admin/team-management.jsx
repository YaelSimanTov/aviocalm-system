import React from 'react';
import AddTherapistForm from '../add-therapist-form/add-therapist-form';
import TherapistList from '../therapist-list/therapistlist';

export const TeamManagement = () => {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Team Management</h1>
        <p className="text-gray-600">
          Create new therapists and manage the existing therapist team.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Create Therapist</h2>
        <AddTherapistForm />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Therapist List</h2>
        <TherapistList />
      </div>
    </div>
  );
};

export default TeamManagement;