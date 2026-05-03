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

* **File Placement & Architecture Rules:**
  * **Backend Source Code:** All core application code (such as routes, controllers, middleware, db configs, and `server.js`) MUST be placed inside the `backend/src/` directory. Do not place application code in the backend root.
  * **Backend Scripts:** Any standalone utility, database setup, or manual testing scripts MUST be placed inside the `backend/scripts/` directory.
  * **Documentation:** All markdown and architectural documentation MUST be placed inside the `backend/docs/` directory.
  * **Frontend Source Code:** All React components, contexts, hooks, and pages MUST be placed appropriately within the `frontend/src/` hierarchy.
  * **Global Rule:** Whenever you are tasked with creating a new file, you must first analyze this architectural structure and ensure the file is generated in the correct folder. Never dump files into the root directories unless it is a root-level configuration file (e.g., .env, package.json).

---

## Detailed Roadmap & User Stories

### Epic 1: Identity & Security Management (Updated)
**Goal:** Secure access management for Owner and Therapists, including strict password policy enforcement and centralized reset management.

#### User Story 1.1: System Login
* **[FE] UI:** Remove 'Forgot Password' link. Add tooltip: 'Forgot your password? Please contact System Owner.'
* **[FE] Navigation:** If `is_first_login` is True -> Redirect immediately to `/change-password` (Internal), If False -> Proceed to Role-Based Routing (/patients or /global-stats).
* **[BE] API:** `POST /api/auth/login`. Verify Hash, return JWT containing Role. 401 generic error for failures.
* **[FE] Validation:** Show red "Required field" under empty inputs.
* **[FE] Error Handling:** Show "Invalid username or password" for 401 errors.

#### User Story 1.2: Internal Password Change (First Login / Security Update)
* **[FE] UI:** Build `/change-password` page as a Protected Route.
* **[FE] Form:** Form with 3 fields: Current Password, New Password, Confirm New Password.
* **[FE] Component:** Add a 'Change Password' button in Sidebar Settings.
* **[FE] Validation:** 8+ chars, Uppercase, Lowercase, Number/Special char.
* **[BE] API:** `POST /api/auth/change-password`. Verify current password, hash new, set `is_first_login = false`.
* **[FE] Flow:** On success -> Show success message -> Call logout() -> Redirect to `/login`.

#### User Story 1.3: Therapist Creation & Temporary Password
* **[BE] API:** `POST /api/admin/create-therapist` (Owner only). Generate `Temp123!`, set `is_first_login = true`.
* **[FE] UI:** 'Team Management' page with 'Add Therapist' form.
* **[FE] Form:** Username, First Name, Last Name fields.
* **[FE] Validation:** Ensure all fields are filled and username contains no forbidden characters.
* **[FE] Feedback:** Success modal showing credentials for Owner to copy and send manually.

#### User Story 1.4: Manual Password Change by Owner
* **[BE] API:** `POST /api/admin/change-password-request`.
* **[BE] Logic:** Owner sets a new temp password and flips `is_first_login` back to true.
* **[FE] UI:** Add a ' Credentials' button (Shield/Key icon) in Team Management table.

**Important:** Keep all filenames in kebab-case and ensure all security routes are correctly protected.

---

### Epic 2: Patient Management
**Goal:** Allow therapists to create, edit, and view patient records with role-based access control.

#### User Story 2.1: Patient Intake & Management (Updated)
* **[DB] Schema:** Updated Table `patients`: 
  - `id` (UUID Primary Key, auto-generated)
  - `national_id` VARCHAR(20) UNIQUE NOT NULL (Real-world ID)
  - `full_name` VARCHAR(255) NOT NULL
  - `phone` VARCHAR(20)
  - `email` VARCHAR(255)
  - `date_of_birth` DATE
  - `address` TEXT
  - `medical_history` TEXT
  - `phobia_type` VARCHAR(50) DEFAULT 'Flight'
  - `phobia_description` TEXT
  - `phobia_triggers` TEXT
  - `calming_factors` TEXT
  - `emergency_contact_name` VARCHAR(255)
  - `emergency_contact_phone` VARCHAR(20)
  - `therapist_id` UUID NOT NULL REFERENCES users(user_id) (Updated from linked_therapist_id)
  - `status` VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Discharged'))
  - `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
* **[FE] UI:** Enhanced Patient List with Search by Name/ID.
* **[FE] Form:** **NEW 2-Step Add Patient Form**:
  - Step 1: Personal & Contact (National ID, Full Name, Phone, Email, Date of Birth, Address)
  - Step 2: Medical & Phobia (Phobia Type dropdown, Medical History, Phobia Description, Triggers, Calming Factors, Emergency Contacts)
  - Progress indicator showing current step
  - Real-time validation per step
  - Loading states and error handling
* **[BE] API:** Enhanced endpoints:
  - `POST /api/patients` - Therapists only, validates national_id uniqueness
  - `GET /api/patients` - Role-based (Owner: all, Therapist: own)
  - `GET /api/patients/:id` - Role-based access control
  - `PUT /api/patients/:id` - Role-based update with validation
* **[BE] Logic:** Enhanced RBAC with therapist_id foreign key constraint
* **[FE] Integration:** Bearer Token authentication, loading spinners, success/error toasts

#### User Story 2.2: Patients Dashboard & Search (Updated)
* **[BE] API:** `GET /api/patients?search=...` - Lightweight search with partial string matching (ILIKE) on full_name or national_id. No heavy joins for performance.
* **[FE] UI:** Patients Dashboard with Search Bar component at the top.
* **[FE] Table:** Clean table showing: Name, National ID, and Phobia Type.
* **[FE] Actions:** 'View Profile' button in Actions column that routes to /patients/:id.
* **[FE] Empty State:** Graceful handling showing 'No patients found matching your search'.
* **[Role Control:** Owner sees all patients; Therapists see only their own.

#### User Story 2.3: Full Patient Profile Page with 3 Tabs (NEW)
* **[FE] UI:** Dedicated Patient Profile Page at /patients/:id replacing the old Modal concept.
* **[FE] Tabs:** Three-tab interface:
    1. **Personal Info:** Editable patient details (Full Name, National ID, Phone, Email, Date of Birth, Address, Medical History, Phobia Type, Triggers, Calming Factors, Emergency Contacts).
    2. **Treatment History:** Table showing Date, VR Room, Summary Metrics, and PDF Export button (US 5.3).
    3. **Appointments:** List of future and past sessions.
* **[BE] API:** `GET /api/patients/:id` with JOINs for Appointments and History.
* **[BE] API:** `PUT /api/patients/:id` for updating patient details (Personal Info tab).
* **[Role Control:** Owner can view any patient; Therapists can only view their own patients.

---

### Epic 3: IoT & VR Integration
**Goal:** Real-time ingestion of data from the VR system and Samsung smartwatch.

**User Story 3.1: Real-time Ingestion**
As the system, I want to receive synchronized data from the VR and the smartwatch to build an accurate picture of the patient's anxiety level during the current session.
**Acceptance Criteria:**
* **BE:** Establish a Node.js WebSocket server (with Socket.io) running alongside the REST API (Express) on the same port, using separate event channels for VR and the smartwatch.
* **BE:** Create a DTO for smartwatch data: Heart Rate (HR), Stress Score, and SpO2.
* **BE:** Create a DTO for VR events based on Unity Enums: FlightState and LevelDiff, combined with a SessionID.
* **BE:** Implement State Injection synchronization logic: The server stores the current VR state in memory (Global Scope) and automatically attaches it to every data packet arriving from the smartwatch.
* **DB:** Use PostgreSQL with a relational schema. Create an `AnxietyProfiles` table for real-time data: LogID (PK), SessionID (FK), RecordedAt, VrState, Difficulty, HeartRate, StressScore, SpO2, and TherapistAction.
* **FE:** Implement a `GlobalHeader` React component that listens to server events (socket.io-client) and displays real-time connectivity status for VR and the smartwatch. It must include logic to trigger a "Distress Alert" on the therapist's dashboard if an abnormal heart rate is detected.

**User Story 3.2: Data Aggregation & Clinical Scoring**
**Goal:** Process raw sensor data into clinical insights, factoring in scene difficulty.
As a therapist, I want a weighted anxiety score that separates different VR scenes and their difficulty levels (Easy, Medium, Hard), so I can compare patient responses and measure stress management progress.
**Tasks / Acceptance Criteria:**
* **DB:** Create a `SceneStressScores` table in PostgreSQL: ScoreID (PK), SessionID (FK), PatientID (FK), VrState, Difficulty, AvgHeartRate, PeakStressScore, CalculatedWeightedScore, and RecordedAt.
* **BE:** Aggregation Mechanism: A server trigger that detects a change in VR status and aggregates all completed `AnxietyProfiles` records associated with that scene and difficulty.
* **BE:** Weighted Scoring Algorithm: Develop a service calculating a final score (Engineering Note: Weighting varies by difficulty, e.g., leniency for "Hard"). Save the result with the difficulty tag.
* **BE/DB:** Session Integrity: Ensure every summary row is correctly linked to the SessionID and PatientID for historical comparison.

---

### Epic 4: Data Analysis & Safety Engine
**Goal:** Analyze metrics, detect statistical anomalies, and adjust treatment in the clinical environment.

**User Story 4.1: The Safety Brakes (Reactive Engine)**
As a therapist, I want the system to automatically and immediately halt the VR if medical or physiological red lines are crossed, preventing physical harm or emotional flooding.
**Tasks:**
* **DB:** `MedicalNorms` Table: Age_Group, HR_Max, HR_Min, SpO2_Min, Stress_Max, Duration_Threshold (seconds), and Delta_HR_Percent.
* **DB:** `PatientBaselines` Table: Structure to save baseline data (average HR/stress) sampled during the first 3 minutes of calibration.
* **BE (Rule Engine):** Implement a decision engine checking three channels per sample:
  1. **Absolute Safety Channel:** Stop if SpO2 < SpO2_Min OR HR > HR_Max for Duration_Threshold.
  2. **Relative Statistical Channel:** Stop if HR crosses the baseline by Delta_HR_Percent OR crosses a personal statistical threshold (e.g., Z-Score) for the Duration.
  3. **Combined Panic Channel:** Stop if Stress Score > Stress_Max PLUS a consistent rise in HR.
* **BE:** `EmergencyStop` Signal: Endpoint to send a TERMINATE command via WebSocket.
* **Data Analysis:** Anomaly Filtering: Implement noise filtering (e.g., Moving Average) to ensure stops aren't triggered by abrupt watch movements.
* **FE:** Manual Override: A prominent red "Stop Simulation" button in the Header for manual therapist intervention.
* **FE:** Display the personal baseline vs. current metrics on the Dashboard for visual context during an emergency stop.

**User Story 4.2: The Proactive Radar (Predictive Engine)**
As a therapist, I want early warnings regarding rising stress trends so I can prepare to intervene or pause the session before the patient collapses.
**Tasks:**
* **Data Analysis (Trend Forecasting):**
  * *Statistical Trend & Slope Analysis:* Function calculating the rate of change (derivative/slope) of HR and stress over the last 15 seconds.
  * *Prediction Model:* Logic determining if the patient is "on track" to cross HR_Max shortly, based on the slope.
* **BE:** Warning Dispatcher: Service listening to trend model results and sending a "Warning" signal to the UI if a consistent rise is detected.
* **FE:** Level 1 Alert (Warning): Yellow indication in the Header: "Abnormal rise in stress metrics - monitoring recommended".
* **FE:** Trend Indicator arrow next to the metric showing stable, rising, or falling.

**User Story 4.3: Progression Heuristics**
As a therapist, I want a data-driven recommendation on whether the patient is ready for higher exposure.
**Tasks:**
* **BE Logic (Weighted Scoring):** Algorithm analyzing the Recovery Rate (return to Baseline) at the end of each stage.
* **BE Logic (Patient Profiling):** Statistical classification mapping the patient to a behavioral profile (e.g., "fast responder").
* **FE UI (Recommendation):** Display a "Recommendation Card" at the end of a VR room with traffic-light colors (Green: Proceed / Yellow: Repeat stage).
* **FE (Feedback Loop):** Add "Agree/Disagree" buttons next to the recommendation to collect professional feedback (Human in the loop).
* **DB:** Save decisions (recommendation vs. actual action) in a `TreatmentDecisions` table.

---

### Epic 5: Reporting & Analytics

**User Story 5.1: Patient Analytics & XAI**
**Tasks:**
* **FE:** Integration with a charting library (D3.js / Chart.js).
* **FE:** Multi-axis line chart displaying HR and Stress/SpO2 over time, with Annotations when VR rooms change.
* **BE:** Fetch data from `AnxietyProfile` and perform statistical aggregation by scene.
* **BE Rule-Engine (Insight Generator):** Engine generating text-based insights based on statistics (e.g., "Note: Patient shows high sensitivity during the landing phase").
* **FE:** Display "System Conclusions" as text.
* **FE (Explainability Markers):** Add Markers on the chart showing when the system crossed statistical thresholds and sent alerts, for full clinical transparency.
* **BE Logic:** Integrate Feedback Loop - note if the therapist agreed with similar insights previously.

**User Story 5.2: Global Stats (Owner Dashboard)**
**Tasks:**
* **FE (Access Control):** Restricted page for Owners only (Admin Sidebar).
* **BE:** Aggregation queries for average anxiety reduction across session series.
* **FE:** Management screen showing total patients, phobia distribution, and PDF export option.
* **BE Aggregation:** Calculate a "Treatment Success Rate" metric.

**User Story 5.3: Treatment PDF Report**
**Tasks:**
* **BE:** Endpoint for a PDF generator pulling metrics, durations, and insights.
* **BE Content:** PDF Structure: Title, AvioCalm logo, patient details, metrics table, and text summary.
* **Security:** Watermark with therapist name and date to prevent forgery.
* **FE:** "Download PDF" button in the patient's "Treatment History" tab.

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
- **First Login Flow:** If `is_first_login` is true, force redirect to `/change-password` regardless of role.

### 3. Global Header Implementation
- **Connectivity Status:** Live icons for VR Headset and Smartwatch (Green: Connected / Red: Offline).
- **Panic State:** If high distress is detected (US 4.1), Header must flash Red across all pages.
- **Emergency Pop-up:** Shows 'Emergency' alert across ALL pages for the active therapist when distress is detected.
- **AI Feedback Loop:** Agree/Disagree buttons for AI recommendations in Live Session.

### 4. Core Logic & Task Refinement
- **Epic 1 (Security):** Remove 'Forgot Password'. If `is_first_login` is true, force redirect to `/change-password`. Successful change must trigger Auto-Logout.
- **Epic 2 (Patients):** Owner role must see all patients; Therapists see only their own. Add 'Status' field (Active/Pending/Closed).
- **Epic 3 (Real-Time):** Setup WebSocket/MQTT for live data. Sync Heart Rate to VR Timestamps. Implement real-time device status indicators.
- **Epic 4 (AI & Safety):** Compare HR to MedicalNorms (Age-based). Implement Emergency Stop logic. Add Therapist Feedback Loop (Agree/Disagree) to all AI recommendations. Global Panic Alert system.

---

## Technical Implementation Plan (Current Focus)
1. Initialize PostgreSQL on port **5433**.
2. Run `schema.sql` to create `users` and `patients` tables.
3. Implement Auth Backend (JWT/Hashing) and Login UI.
4. Implement Owner "Team Management" flow.