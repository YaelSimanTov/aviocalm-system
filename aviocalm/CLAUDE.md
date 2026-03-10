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

### Epic 1: Identity & Security Management (Updated)
**Goal:** Secure access management for Owner and Therapists, including strict password policy enforcement and centralized reset management.

#### User Story 1.1: System Login
* **[FE] UI:** Remove 'Forgot Password' link. Add tooltip: 'Forgot your password? Please contact System Owner.'
* **[FE] Navigation:** If `is_first_login` is True -> Redirect immediately to `/reset-password` (Internal), If False -> Proceed to Role-Based Routing (/patients or /global-stats).
* **[BE] API:** `POST /api/auth/login`. Verify Hash, return JWT containing Role. 401 generic error for failures.
* **[FE] Validation:** Show red "Required field" under empty inputs.
* **[FE] Error Handling:** Show "Invalid username or password" for 401 errors.

#### User Story 1.2: Internal Password Reset (First Login / Security Update)
* **[FE] UI:** Build `/reset-password` page as a Protected Route.
* **[FE] Form:** Form with 3 fields: Current Password, New Password, Confirm New Password.
* **[FE] Component:** Add a 'Reset Password' button in Dashboard Sidebar/Header.
* **[FE] Validation:** 8+ chars, Uppercase, Lowercase, Number/Special char.
* **[BE] API:** `POST /api/auth/reset-password`. Verify current password, hash new, set `is_first_login = false`.
* **[FE] Flow:** On success -> Show success message -> Call logout() -> Redirect to `/login`.

#### User Story 1.3: Therapist Creation & Temporary Password
* **[BE] API:** `POST /api/admin/create-therapist` (Owner only). Generate `Temp123!`, set `is_first_login = true`.
* **[FE] UI:** 'Team Management' page with 'Add Therapist' form.
* **[FE] Form:** Username, First Name, Last Name fields.
* **[FE] Validation:** Ensure all fields are filled and username contains no forbidden characters.
* **[FE] Feedback:** Success modal showing credentials for Owner to copy and send manually.

#### User Story 1.4: Manual Password Reset by Owner
* **[BE] API:** `POST /api/admin/reset-password-request`.
* **[BE] Logic:** Owner sets a new temp password and flips `is_first_login` back to true.
* **[FE] UI:** Add a 'Reset Credentials' button (Shield/Key icon) in Team Management table.

**Important:** Keep all filenames in kebab-case and ensure all security routes are correctly protected.

---

### Epic 2: Patient Management
**Goal:** Allow therapists to create, edit, and view patient records with role-based access control.

#### User Story 2.1: Patient Intake & Management
* **[DB] Schema:** Table `patients`: `id` (Unique ID/PK), `name`, `phone`, `email`, `age`, `address`, `medical_history`, `phobia_type` (Default: Flight), `phobia_triggers`, `calming_factors`, `status` (Active/Pending/Closed), `linked_therapist_id`.
* **[FE] UI:** Patient List with Search by Name/ID.
* **[FE] Form:** Add Patient form with all fields. `phobia_type` as dropdown (Default: "Flight Phobia").
* **[BE] API:** `POST /api/patients`. Validate unique ID.
* **[BE] Logic:** Link patient to therapist who created them (`linked_therapist_id`).
* **[Role Control:** Owner sees all patients; Therapists see only their own.

#### User Story 2.2: Patient Search & Records
* **[BE] API:** `GET /api/patients/:id` with JOINs for Appointments and History.
* **[FE] UI:** Search Bar in Sidebar and Dashboard. Search by Patient ID/Name.
* **[FE] UI:** Error handling if patient not found ("Patient ID not found").
* **[FE] Profile View:** Divided into 3 Tabs/Areas:
    1. **Personal Info:** Editable (Name, Age, Phobia description).
    2. **Treatment History:** Table showing Date, VR Room, and Summary Metrics.
    3. **Appointments:** List of future and past sessions.

---

### Epic 3: IoT & VR Integration
**Goal:** Real-time data ingestion from the VR system and Smartwatch.

##### User Story 3.1: Real-time Ingestion
**As the System, I want to receive synchronized streaming data from the VR and Smartwatch, so that I can monitor the patient's exact anxiety level per room.**

**Tasks:**
- **BE:** Setup WebSocket Server or MQTT Broker for streaming data.
- **BE:** Create DTOs to ingest Smartwatch data (HR, BP, GSR, SpO2).
- **BE:** Create DTOs to ingest VR data (RoomID, SceneID, Timestamp).
- **BE:** Map Smartwatch data to the current VR room based on Timestamps.
- **DB:** Create AnxietyProfile table for raw data. Add a TherapistAction column to log if the therapist agreed/ignored AI alerts.
- **DB:** Create SceneStressScores table for weighted scores per scene.
- **FE:** Implement real-time device status indicators (Connectivity Monitoring) in the Header for the VR Headset and Smartwatch.
* **[FE] Visual Highlight:** Sidebar shows active VR session state.

#### User Story 3.2: Connectivity Management
* **[FE] Global Header:** Live connectivity status icons for VR Headset and Smartwatch.
* **[FE] Status Indicators:** Green: Connected / Red: Offline.

---

### Epic 4: AI Analysis & Safety
**Goal:** Metric analysis, emergency prediction, and treatment path adaptation.

##### User Story 4.1: Real-Time Distress Detection
**As a therapist, I want the system to automatically alert me if the patient is in distress, so that I can stop the session immediately.**

**Tasks:**
- **DB:** Create MedicalNorms table with age/health-based thresholds.
- **BE/AI:** Develop a Rule Engine to compare samples against MedicalNorms.
- **BE:** Implement EmergencyStop signal broadcast. When a panic trend is predicted (LSTM) or detected (Rule Engine), immediately trigger an interrupt command to the VR engine.
- **FE:** Global Panic Alert: Flash the App Header red and show an 'Emergency' pop-up across ALL pages for the active therapist.
- **BE/ML:** Train a real-time 'Stress Index Model' based on HRV, GSR, and respiration.
- **BE/AI:** Implement Time Series Forecasting (LSTM) to predict panic attacks before they occur.

##### User Story 4.2: AI Prediction for Stage Progression
**As a therapist, I want an AI recommendation on whether to advance the VR stage, so that I pace the treatment safely.**

**Tasks:**
- **BE/ML:** Train a classification model (Random Forest) based on current metrics and history.
- **BE:** Execute the model at the end of each VR Stage.
- **FE:** Display progression recommendation. Add Feedback Loop buttons (Agree/Disagree) to the UI to capture therapist input and improve model accuracy.
- **BE/ML:** Use K-Means clustering to recommend the best treatment path based on similar patient profiles.

---

### Epic 5: Reporting & Analytics
**Goal:** Professional clinical reporting and business intelligence for therapeutic outcomes.

#### Task 5.1: Patient Insight Dashboard
- **FE:** Implement a multi-line Chart (Chart.js) showing Heart Rate, SpO2, and VR Scene transitions on a shared timeline.
- **FE:** Add visual markers for AI-triggered alerts (from US 4.1) on the chart.
- **AI:** Integrate the Insight Generator to produce text summaries. Include the therapist's historical feedback (Agree/Disagree) to contextualize AI suggestions.

#### Task 5.2: Owner's Command Center (Global Stats)
- **Access:** Strictly restricted to Owner Role in the Sidebar/Admin section.
- **BE:** Calculate 'Treatment Success Rate' (Anxiety reduction trends across all patients).
- **FE:** Display high-level KPIs: Active Patients, Active Therapists, and Phobia Distribution.

#### Task 5.3: Professional PDF Export
- **FE:** Place the 'Export Summary' button inside the Patient Profile page and the post-session summary screen.
- **BE:** PDF must include patient metadata, session graphs, and AI-generated clinical conclusions.
- **Security:** Add a timestamp and therapist name to the PDF header for clinical auditing.

---

## Navigation Architecture & UI Components

### 1. Visual Sidebar Structure (LTR - Left-to-Right)
**👥 Clinical (Group):**
- **Patient List:** Includes Search by Name/ID.
- **Add Patient:** Form for new entries (US 2.1).

**🥽 Live Session (Group):** (Highlight visually when a VR session is active)
- **Active Monitor:** Real-time heart rate/VR telemetry (US 3.1).
- **AI Insights:** Real-time stage progression advice (US 4.2).

**📊 Analytics (Group):** (Patient-specific data - visible to all therapists)
- **Patient Insights:** Individual stress analysis and trends (US 5.1).
- **Clinical Cohorts:** AI-driven patient similarity groups.

**📅 Calendar:** Appointment scheduling.

**🛡️ Admin (Owner Only):** Business-level data and system management
- **Team Management:** Manage therapists and staff (US 1.3).
- **Global Stats:** Clinic-wide KPIs and business metrics (US 5.2).

**⚙️ Settings (Group):**
- **Change Password:** Personal security update.
- **Logout.**

### 2. Role-Based Routing Logic
- **Therapist Home Page:** After successful login (when `is_first_login` is false), redirect to **Patient List** (US 2.2).
- **Owner Home Page:** After successful login (when `is_first_login` is false), redirect to **Global Stats** (US 5.2).
- **First Login Flow:** If `is_first_login` is true, force redirect to `/reset-password` regardless of role.

### 3. Global Header Implementation
- **Connectivity Status:** Live icons for VR Headset and Smartwatch (Green: Connected / Red: Offline).
- **Panic State:** If high distress is detected (US 4.1), Header must flash Red across all pages.
- **Emergency Pop-up:** Shows 'Emergency' alert across ALL pages for the active therapist when distress is detected.
- **AI Feedback Loop:** Agree/Disagree buttons for AI recommendations in Live Session.

### 4. Core Logic & Task Refinement
- **Epic 1 (Security):** Remove 'Forgot Password'. If `is_first_login` is true, force redirect to `/reset-password`. Successful reset must trigger Auto-Logout.
- **Epic 2 (Patients):** Owner role must see all patients; Therapists see only their own. Add 'Status' field (Active/Pending/Closed).
- **Epic 3 (Real-Time):** Setup WebSocket/MQTT for live data. Sync Heart Rate to VR Timestamps. Implement real-time device status indicators.
- **Epic 4 (AI & Safety):** Compare HR to MedicalNorms (Age-based). Implement Emergency Stop logic. Add Therapist Feedback Loop (Agree/Disagree) to all AI recommendations. Global Panic Alert system.

---

## Technical Implementation Plan (Current Focus)
1. Initialize PostgreSQL on port **5433**.
2. Run `schema.sql` to create `users` and `patients` tables.
3. Implement Auth Backend (JWT/Hashing) and Login UI.
4. Implement Owner "Team Management" flow.