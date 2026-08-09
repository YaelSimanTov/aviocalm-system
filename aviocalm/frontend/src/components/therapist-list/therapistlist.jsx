import React, { useState, useEffect } from 'react';
import './therapistlist.css';
import PasswordResetModal from './passwordresetmodal';
import EditTherapistModal from './edittherapistmodal';
import DeleteConfirmModal from './deleteconfirmmodal';
import { Trash2, Edit, Key, MoreVertical, Search, UserX } from 'lucide-react';

const TherapistList = () => {
  const [therapists, setTherapists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [resetData, setResetData] = useState(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [editingTherapist, setEditingTherapist] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [therapistToDelete, setTherapistToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => { fetchTherapists(); }, []);

  const fetchTherapists = async () => {
    try {
      const token = localStorage.getItem("aviocalm_token");
      const response = await fetch("http://localhost:5000/api/owner/therapists", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setTherapists(data.therapists || []);
      } else {
        setTherapists([]);
      }
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const filteredTherapists = (therapists || []).filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      (t.username     || '').toLowerCase().includes(term) ||
      (t.first_name   || '').toLowerCase().includes(term) ||
      (t.last_name    || '').toLowerCase().includes(term) ||
      (t.email        || '').toLowerCase().includes(term) ||
      (t.phone_number || '').includes(term)
    );
  });

  const confirmDelete = async () => {
    if (!therapistToDelete) return;

    try {
      const token = localStorage.getItem("aviocalm_token");

      const response = await fetch(`http://localhost:5000/api/owner/therapists/${therapistToDelete}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok) {
        setTherapists(therapists.filter(t => t.username !== therapistToDelete));
        setIsDeleteModalOpen(false);
        setTherapistToDelete(null);
      } else {
        alert(data.message || "Delete failed");
      }
    } catch (error) {
      console.error(error);
      alert("Delete failed");
    }
  };

  const handleResetPassword = async (username) => {
    try {
      const token = localStorage.getItem("aviocalm_token");
      const res = await fetch("http://localhost:5000/api/owner/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (data.success) { setResetData(data); setIsResetOpen(true); }
    } catch (error) { alert("Reset failed"); }
  };

  const handleEditSave = async (username, updatedData) => {
    try {
      const token = localStorage.getItem("aviocalm_token");
      const response = await fetch(`http://localhost:5000/api/owner/therapists/${username}`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(updatedData)
      });
      const data = await response.json();
      if (response.ok) {
        setIsEditOpen(false);
        fetchTherapists();
        return { success: true };
      }
      // Return the server error so the modal can display it inline
      return { success: false, error: data.message || data.error || 'Update failed. Please try again.' };
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="therapist-list p-6 pt-24">
       
      <div className="mb-8 mt-4 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-lg text-sm bg-gray-50 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
            placeholder="Search by username or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="therapist-list__table-container bg-white rounded-2xl shadow-sm border border-slate-100 overflow-visible">
        {filteredTherapists.length === 0 ? (
          <div className="py-20 text-center">
            <UserX size={32} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-900">No Therapists Found</h3>
          </div>
        ) : (
          <table className="therapist-list__table w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Username</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Full Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTherapists.map((t) => (
                <tr key={t.username} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-blue-600 font-medium">{t.username}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{t.first_name} {t.last_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {t.email
                      ? <a href={`mailto:${t.email}`} className="hover:text-blue-600 hover:underline transition-colors">{t.email}</a>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {t.phone_number || <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-6 py-4 text-center relative">
                    <button onClick={() => setOpenMenuId(openMenuId === t.username ? null : t.username)} className="p-2 text-slate-400">
                      <MoreVertical size={18} />
                    </button>

                    {openMenuId === t.username && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                        <div className={`absolute right-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 animate-in fade-in zoom-in duration-150 ${filteredTherapists.indexOf(t) > filteredTherapists.length - 3 ? 'bottom-full mb-2' : 'mt-2'}`}>
                          <button onClick={() => { setEditingTherapist(t); setIsEditOpen(true); setOpenMenuId(null); }} className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <Edit size={16} className="mr-3 text-blue-600" /> Edit Profile
                          </button>
                          <button onClick={() => { handleResetPassword(t.username); setOpenMenuId(null); }} className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <Key size={16} className="mr-3 text-amber-600" /> Reset Password
                          </button>
                          <div className="my-1 border-t border-slate-100"></div>
                          <button
                            onClick={() => {
                              setTherapistToDelete(t.username);  
                              setIsDeleteModalOpen(true);  
                              setOpenMenuId(null);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} className="mr-3" /> Delete Therapist
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PasswordResetModal isOpen={isResetOpen} data={resetData} onClose={() => setIsResetOpen(false)} />
      <EditTherapistModal isOpen={isEditOpen} therapist={editingTherapist} onClose={() => setIsEditOpen(false)} onSave={handleEditSave} />

       <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        username={therapistToDelete}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default TherapistList;