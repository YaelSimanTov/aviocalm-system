import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './add-therapist-form.css';
import CreatedTherapistModal from './createdtherapistmodal';

const AddTherapistForm = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
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

    if (!form.username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!form.firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!form.lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    // Validate email format when provided
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    // Validate phone number when provided:
    // strip everything except digits and a leading '+', then check length 9–15
    if (form.phoneNumber.trim()) {
      const leading = form.phoneNumber.startsWith('+') ? '+' : '';
      const digits  = form.phoneNumber.replace(/\D/g, '');
      const cleaned = leading + digits;
      if (digits.length < 9 || digits.length > 15) {
        setError("Phone number must contain 9–15 digits (a leading + is allowed).");
        return;
      }
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
        setForm({ username: "", firstName: "", lastName: "", email: "", phoneNumber: "" });
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
      {/* Back button — identical styling to patient-profile__back-btn */}
      <div className="w-full max-w-[500px] mb-4">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-500 hover:bg-slate-600 text-white text-sm font-medium rounded border-0 cursor-pointer transition-all hover:-translate-y-px"
        >
          ← Back
        </button>
      </div>

      <div className="add-therapist-card">
        <h2 className="add-therapist-card__title">Create New Therapist</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 mb-5 rounded-r-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="add-therapist-form__group">
            <label className="add-therapist-form__label">Username</label>
            <input
              type="text"
              name="username"
              className="add-therapist-form__input"
              placeholder="Enter username"
              value={form.username}
              onChange={handleChange}
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
            />
          </div>

          <div className="add-therapist-form__group">
            <label className="add-therapist-form__label">
              Email <span className="text-slate-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="email"
              name="email"
              className="add-therapist-form__input"
              placeholder="therapist@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>

          <div className="add-therapist-form__group">
            <label className="add-therapist-form__label">
              Phone Number <span className="text-slate-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              name="phoneNumber"
              className="add-therapist-form__input"
              placeholder="+972501234567"
              value={form.phoneNumber}
              onChange={handleChange}
              autoComplete="tel"
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
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default AddTherapistForm;