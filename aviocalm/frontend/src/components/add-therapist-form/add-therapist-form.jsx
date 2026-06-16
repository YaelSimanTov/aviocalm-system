import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 🔥 תוספת 1: ייבוא כלי הניווט
import './add-therapist-form.css';
import CreatedTherapistModal from './createdtherapistmodal';

const AddTherapistForm = () => {
  const navigate = useNavigate(); // 🔥 תוספת 2: אתחול הניווט

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [successData, setSuccessData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const usernameRegex = /^(?=.*[0-9])[A-Za-z0-9_]{5,}$/;
    if (!usernameRegex.test(form.username)) {
      setError("Username must be at least 5 characters, include a digit, and contain English letters, numbers or underscore only.");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("aviocalm_token");
      const response = await fetch("http://localhost:5000/api/owner/create-therapist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessData(data);
        setIsModalOpen(true);
        setForm({ username: "", firstName: "", lastName: "" });
      } else {
        setError(data.message || "Error creating therapist");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    navigate('/admin/team-management');
  };

  return (
    <div className="add-therapist-container">
      <h1 className="add-therapist-page-title">Create Therapist</h1>

      <div className="add-therapist-card">
        <h2 className="add-therapist-card__title">Create New Therapist</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="add-therapist-form__group">
            <label className="add-therapist-form__label">Username</label>
            <input
              type="text"
              name="username"
              className={`add-therapist-form__input ${error ? 'border-red-500' : ''}`}
              placeholder="e.g. yael1"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-therapist-form__group">
            <label className="add-therapist-form__label">First Name</label>
            <input
              type="text"
              name="firstName"
              className="add-therapist-form__input"
              placeholder="Enter first name"
              value={form.firstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="add-therapist-form__group">
            <label className="add-therapist-form__label">Last Name</label>
            <input
              type="text"
              name="lastName"
              className="add-therapist-form__input"
              placeholder="Enter last name"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="add-therapist-form__submit-btn"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Therapist"}
          </button>
        </form>
      </div>

      <CreatedTherapistModal
        isOpen={isModalOpen}
        data={successData}
        onClose={handleCloseModal} // 🔥 משתמשים בפונקציה החדשה
      />
    </div>
  );
};

export default AddTherapistForm;