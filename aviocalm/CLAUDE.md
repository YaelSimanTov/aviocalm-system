 # CLAUDE.md - AvioCalm System (Full Specification)

## Project Overview
AvioCalm is a professional therapeutic platform for treating Aerophobia (fear of flying) using VR environments and real-time biofeedback from Samsung Wear OS devices. The system leverages AI to detect distress, predict panic attacks, and provide clinical insights.

## Core Technology Stack
* **Frontend:** React, Tailwind CSS, Chart.js/D3.js
* **Backend:** Node.js (Express), WebSocket/MQTT for IoT
* **Database:** PostgreSQL (**Port: 5433**, DB Name: `aviocalm`)
* **AI/ML Engine:** Python (FastAPI) for LSTM Trend Prediction & K-Means Clustering
* **VR:** WebXR / A-Frame Integration

## System Rules & Conventions
* **Naming:** `kebab-case` for file names, `camelCase` for variables/functions, `snake_case` for DB columns.
* **Security:** JWT for Role-Based Access Control (RBAC). Use Salt + Hash for passwords.
* **Responses:** Standard JSON format: `{ "success": boolean, "data": any, "error": string }`.

---

## Detailed Roadmap & User Stories

### Epic 1: Identity & Security (Authentication & Authorization)
**Goal:** Secure access management for Owner and Therapists with strict password policies.

#### User Story 1.1: Secure Login
* **[DB] User Schema:** Create `users` table: `user_id` (UUID/PK), `username` (Unique), `password_hash`, `salt`, `role` (Owner/Therapist), `is_first_login` (Boolean), `first_name`, `last_name`.
* **[BE] API:** `POST /api/auth/login`. Verify Hash, return JWT containing Role. 401 generic error for failures.
* **[FE] UI:** Login Page with Username and Password fields.
* **[FE] Validation:** Show red "Required field" under empty inputs. 
* **[FE] Error Handling:** Show "Invalid username or password" for 401 errors.
* **[FE] Navigation:** * If `is_first_login` is True -> Redirect to `/force-password-change`.
    * If `is_first_login` is False -> Redirect to `/dashboard`.
* **[FE] Extras:** "Forgot Password" link pointing to password change page.

#### User Story 1.2: Password Management
* **[FE] UI:** Change Password page with 3 fields: Old Password, New Password, Confirm New Password.
* **[FE] Real-time Validation (Client):** * Minimum 8 characters.
    * At least one Uppercase (A-Z).
    * At least one Lowercase (a-z).
    * Special character (!@#$%) and a Number.
    * Matching passwords validation for confirmation field.
* **[BE] API:** `POST /api/auth/change-password`. Verify old password, server-side Regex validation, update Hash, set `is_first_login = false`.
* **[FE] Post-Success:** Show success message and redirect to login.

#### User Story 1.3: Owner Onboarding (Therapist Creation)
* **[BE] API:** Protected `POST /api/admin/create-therapist` (Owner role only).
* **[BE] Logic:** Create user with temporary password (e.g., `Temp123!`), hash it, and set `is_first_login = true`.
* **[FE] UI:** "Team Management" page for Owners.
* **[FE] Form:** "Add New Therapist" form (Username, First Name, Last Name).
* **[FE] Validation:** Ensure all fields are filled and username contains no forbidden characters.
* **[FE] Feedback:** Show success message with the credentials to be provided to the therapist.

---

### Epic 2: Patient Management
**Goal:** Allow therapists to create, edit, and view patient records.

#### User Story 2.1: Patient Intake
* **[DB] Schema:** Table `patients`: `id` (Unique ID/PK), `name`, `phone`, `email`, `age`, `address`, `medical_history`, `phobia_type` (Default: Flight), `phobia_triggers`, `calming_factors`.
* **[FE] UI:** Intake form with all fields. `phobia_type` as dropdown (Default: "Flight Phobia").
* **[FE] UI:** Textarea for "Phobia Description" (takeoff, landing, height, etc.).
* **[BE] API:** `POST /api/patients`. Validate unique ID.
* **[BE] Logic:** Link patient to the therapist who created them (`linked_therapist_id`).

#### User Story 2.2: Search & Patient Records
* **[BE] API:** `GET /api/patients/:id` with JOINs for Appointments and History.
* **[FE] UI:** Search Bar in Therapist Dashboard. Search by Patient ID.
* **[FE] UI:** Error handling if patient not found ("Patient ID not found").
* **[FE] Profile View:** Divided into 3 Tabs/Areas:
    1. **Personal Info:** Editable (Name, Age, Phobia description).
    2. **Treatment History:** Table showing Date, VR Room, and Summary Metrics.
    3. **Appointments:** List of future and past sessions.

---

### Epic 3: VR & IoT Integration
**Goal:** Real-time data ingestion from VR systems and Samsung smartwatches.

#### User Story 3.1: Real-time Data Ingestion
* **[BE] Infrastructure:** Setup WebSocket Server or MQTT Broker for data streaming.
* **[BE] DTOs:** Watch data (Heart Rate, Blood Pressure, GSR, SpO2) and VR data (RoomID, SceneID, Timestamp).
* **[BE] Sync Logic:** Align bio-feedback with VR scenes based on timestamps.
* **[DB] Schema:** * `anxiety_profile`: Raw Data (e.g., Heart rate per second).
    * `scene_stress_scores`: Weighted score per scene (FK to Patient/Session).

---

### Epic 4: AI Analysis & Safety (The "Brain")
**Goal:** Metric analysis, emergency detection, and treatment optimization.

#### User Story 4.1: Distress Detection & Alerts
* **[DB] Schema:** Table `medical_norms` (Min/Max ranges for HR/BP by age/health status).
* **[BE/AI] Logic:** Rule Engine comparing real-time samples to norms.
* **[BE] Detection:** Identify "Dangerous Deviations" (e.g., HR > 180 for 10s).
* **[BE] Action:** Send `EmergencyStop` event to VR system to pause simulation.
* **[FE] UI:** Red flashing Pop-up in Therapist Dashboard: "Distress Alert! Abnormal Heart Rate".
* **[BE/ML] Stress Index:** Real-time model calculating stress via HRV, GSR, and Respiration.
* **[BE/AI] Trend Prediction:** LSTM Time Series model to predict panic attacks before they occur.

#### User Story 4.2: Progression Prediction
* **[AI/ML] Model:** Classification (Random Forest) based on age, history, and current metrics.
* **[BE] Logic:** Run model after each VR Stage.
* **[FE] Feedback:** Display "Recommended to proceed" (Green) or "Recommend repeating stage" (Yellow).
* **[AI/ML] Clustering:** K-Means to cluster patients by profile and suggest the most effective historical treatment path.

---

### Epic 5: Reporting & Analytics
**Goal:** Visualization of data for therapists and owners.

#### User Story 5.1: Therapist Analytics Dashboard
* **[FE] Viz:** Integration with Chart.js/D3.js.
* **[FE] Graph:** Line Chart showing heart rate over time with VR room annotations.
* **[BE] API:** Aggregated data from `anxiety_profile` grouped by scene.
* **[BE/AI] Insights:** Text generation based on data (e.g., "Note: Patient shows high sensitivity during landing").

#### User Story 5.2: Owner Global Stats
* **[BE] API:** Complex aggregation (Avg. anxiety drop from session 1 to 5 across all patients).
* **[FE] UI:** Management screen: Active patients, number of therapists, phobia distribution charts.
* **[FE] Export:** Export global report to PDF.

#### User Story 5.3: Session Summary Report
* **[BE] API:** PDF Generator using latest session data and AI conclusions.
* **[FE] Action:** "Generate Summary Report" button on Patient profile page.

---

## Technical Implementation Plan (Current Focus)
1. Initialize PostgreSQL on port **5433**.
2. Run `schema.sql` to create `users` and `patients` tables.
3. Implement Auth Backend (JWT/Hashing) and Login UI.
4. Implement Owner "Team Management" flow.