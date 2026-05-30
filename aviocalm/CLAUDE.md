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

#### User Story 2.3: Patient Profile - Personal Info Edit
- **Description:** As a therapist (or admin), I want to edit and update a patient's personal and medical details from the `Personal Info` tab while keeping their National ID strictly read-only to maintain medical data integrity and prevent identity mismatches.
- **Tasks:**
  - **BE Data Fetching:** Implement `GET /api/patients/:id` to fetch ONLY demographic data, medical background, emergency contacts, and phobia records for this specific tab. (Do NOT perform complex joins with appointments or session telemetry here).
  - **BE Data Update:** Implement `PUT /api/patients/:id` to receive and update the editable personal fields in the database.
  - **BE Data Integrity Gate:** The server must explicitly drop, ignore, or reject (400 Bad Request) any incoming attempts to alter the `national_id` column within the PUT request body.
  - **BE RBAC Logic:** Validate that an Owner can access/edit all profiles, while a Therapist can only view/edit patients assigned to them directly in the DB (return 403 Forbidden if unauthorized).
  - **FE Read-Only Fields:** Force the `National ID` input field to be permanently locked in the form UI using `disabled={true}` or `readOnly` to prevent physical modifications.
  - **FE Validation Engine:** Implement a `validateForm` engine triggered on "Save Changes" that returns false and halts the API PUT request if any validation rule is broken.
  - **FE Required Fields Check:** Enforce that `full_name` and `date_of_birth` are mandatory and cannot be left blank.
  - **FE Regex & Format Rules:** Validate `email` format (must contain @, dots, and no whitespace) and `phone` format (numbers and valid prefixes only) if values are provided.
  - **FE Error State UI:** When validation fails, style the faulty input field with a red border and render a clear, red helper message directly beneath it (e.g., "Please enter a valid email address").
  - **FE Error State Cleanup:** Fully reset/clear all error states from the screen on form "Cancel", on a successful API save (200 OK), and dynamically clear a field-specific error message `onChange` as soon as the user focuses and starts retyping.
  - **UX Location & Navigation:** The edit form and action buttons reside entirely inside the first tab (`Personal Info`) of the unified Patient Profile view (accessible via the `/analytics/:patientId` route).

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
* **UX (UI Location & Navigation):** Connectivity status and distress alerts will be located in the Global Header. Live data display (charts) will be located in the 🥽 Live Session -> Active Monitor page.

**User Story 3.2: Data Aggregation & Clinical Scoring**
**Goal:** Process raw sensor data into clinical insights, factoring in scene difficulty.
As a therapist, I want a weighted anxiety score that separates different VR scenes and their difficulty levels (Easy, Medium, Hard), so I can compare patient responses and measure stress management progress.
**Tasks / Acceptance Criteria:**
* **DB:** Create a `SceneStressScores` table in PostgreSQL: ScoreID (PK), SessionID (FK), PatientID (FK), VrState, Difficulty, AvgHeartRate, PeakStressScore, CalculatedWeightedScore, and RecordedAt.
* **BE:** Aggregation Mechanism: A server trigger that detects a change in VR status and aggregates all completed `AnxietyProfiles` records associated with that scene and difficulty.
* **BE:** Weighted Scoring Algorithm: Develop a service calculating a final score (Engineering Note: Weighting varies by difficulty, e.g., leniency for "Hard"). Save the result with the difficulty tag.
* **BE/DB:** Session Integrity: Ensure every summary row is correctly linked to the SessionID and PatientID for historical comparison.
* **UX (UI Location & Navigation):** Tables and charts displaying weighted scores and historical comparisons will be shown in the Patient Profile -> Treatment History tab (accessible via Clinical -> Patient List -> View Record).

---

### Epic 4: Remote Monitoring & Safety Engine
**Goal:** Asynchronous medical metrics analysis, statistical anomaly detection, and smart alert generation for remote VR sessions.

### User Story 4.1: Smart Alerts & Clinical Annotations
**As a therapist,** I want the system to automatically analyze patient metrics during their at-home sessions, and generate centralized alerts in the interface (and annotations on the graph) if critical thresholds are crossed, **so that** I can efficiently review the critical moments in the sessions without watching them in real-time.

#### Tasks / Acceptance Criteria:

**✅ Phase 1 COMPLETE — DB & Backend Rule Engine**

**1. DB - Data & Rules Infrastructure:** ✅
* **`medical_norms` table:** Seeded via `003_seed_medical_norms.sql` (HR_Max=100, SpO2_Min=95, Stress_Max=75, Duration=30s, Delta=25%).
* **`patient_baselines` table:** Extended with `session_id` FK via `002_create_alerts_table.sql`; baseline persisted after 10-sample calibration window.
* **`alerts` table (New):** ✅ Created via `002_create_alerts_table.sql`; verified rows with `duration_seconds > 0` (Safety: 41s, Statistical: 43s).

**2. BE - Rule Engine & Signal Processing:** ✅ (`backend/src/services/ruleEngine.js`)
* **Anomaly Filtering:** 5-point Moving Average via `SignalProcessingService` per session instance.
* **State Tracking:** Per-channel breach lifecycle tracked in `openBreaches` Map; duration calculated on resolution; alert persisted only if `duration_seconds >= duration_threshold`.
* **Continuous Channel Checking:** All 3 channels evaluated every sample via `SafetyEngine`:
    * **Absolute Safety Channel:** `SpO2 < SpO2_Min` or `HR > HR_Max`. ✅
    * **Relative Statistical Channel:** HR spike above personal baseline by `Delta_HR_Percent`. ✅
    * **Combined Panic Channel:** `Stress Score > Stress_Max` + consistent upward HR trend. ✅

**3. FE - Notification Center:**
* **Header Bell Icon:** Add a bell icon in the Header of the therapist's interface. The icon will display a red badge with the number of alerts where `is_read = false`.
* **Notifications Dropdown:** Clicking the bell opens a dropdown list showing the latest alerts (date, time, patient name, ID).
* **Alert Modal:** Clicking a specific alert row will mark it as read (`is_read = true`) and open a modal explaining exactly why the alert was generated, **including the duration of the event** (e.g., *"Oxygen drop to 91% detected, lasting 45 seconds"*). The modal will include a "Go to Full Session Graph" button.

**4. FE - In-Chart Annotation:**
* When the therapist views the Treatment History, the component will fetch the alerts linked to that specific `session_id`.
* **Design Constraint:** Since the graph background is used to display VR flight phases, **DO NOT use background colors** (like `ReferenceArea`) to display alerts.
* **Highlighting the Anomaly:** Instead, show a focused indication directly on the data line itself (e.g., changing the HR line color to red, or adding prominent Dots) along the entire time window of the alert (`timestamp` until the end of `duration_seconds`).
* A hover **Tooltip** over the highlighted area will display the exact anomaly details and its duration.

---

### Epic 5: Asynchronous Analytics & Advanced Patient History

**Objective:** Create an advanced medical analytics system for asynchronous online treatment (patients practicing at home via VR). The system will support navigation from the patient list to a tab-based profile, dynamic session logging, and deep-dive (Drill-down) multi-axis charts with clinical metrics, while filtering physical movement artifacts.

#### User Story 5.1: Patient Profile & Navigation Shell
- **Description:** As a therapist, I want to click "View Record" on a patient row in the Patient List to navigate to a comprehensive, tab-based Patient Profile to avoid cognitive overload.
- **Tasks:**
  - **FE Navigation:** In `PatientList` component (columns: National ID, Name, Status, Created Date, Actions), wire the "View Record" button to route to `/analytics/:patientId`.
  - **FE Tab Layout:** Design the `Patient Profile` layout containing 3 tabs:
    1. `Personal Info`: Demographic data, medical history, phobia details (with inline edit & save).
    2. `Treatment History`: The clinical session log table.
    3. `Progression`: Long-term trend charts.
  - **UX Indicator:** Add a visual indicator (Blue Badge) in `PatientList` next to patients who have unreviewed sessions completed at home.

#### User Story 5.2: Treatment History & Drill-down Trigger
- **Description:** As a therapist, I want to view a table of all sessions for the patient and click a specific session to drill down into its detailed telemetry.
- **Tasks:**
  - **BE Endpoint:** Create `GET /api/patients/:id/sessions` to fetch all history rows from the sessions/telemetry table.
  - **FE Table UI:** Build the table inside the `Treatment History` tab with exact columns: `Date`, `Duration`, `HRV RMSSD`, `Difficulty`, `Status`, `Actions`.
  - **Edge-case Handling:** If a session is `In Progress`, display `N/A` for `Duration` and `HRV RMSSD`.
  - **Difficulty Badges:** Render colored badges for difficulty: `Easy` (Green), `Medium` (Orange), `Hard` (Red). Render gray `N/A` if not applicable.
  - **FE State Trigger:** Clicking the gray "View Record" button on a session row must update the local state to inject the `Session Analytics` view below the table.

#### User Story 5.3: Dual-Axis Time-Series & Flight Stages (Session Analytics Chart)
- **Description:** As a therapist, when viewing a completed session, I want a dual-y-axis line chart showing Heart Rate and Stress simultaneously, overlaid with colored background regions representing VR flight stages.
- **Tasks:**
  - **BE Adaptive Downsampling:** Create a Bucketing Service in the backend to aggregate raw telemetry data into moving averages (e.g., 15-30s windows depending on total duration) to prevent React rendering lag. Output a text indicator like `"Showing 50 data points"`.
  - **FE Recharts Dual-Axis:** Implement a Recharts `LineChart` with two independent Y-axes:
    - Left Axis: `Heart Rate (BPM)` (Blue line).
    - Right Axis: `Stress Score` (0-100 scale, Purple line).
  - **FE Dynamic Plot Bands:** Use Recharts `ReferenceArea` to color-code the chart background based on `VrState` timelines matching the top legend: `Lobby` (Light Blue), `Takeoff` (Light Orange), `Cruising` (Light Green), `Landing` (Light Purple), `Completed` (Light Gray).
  - **FE Baseline Reference Line:** Render a dashed horizontal `ReferenceLine` representing the 3-minute baseline. Display a text indicator below the chart: `"Baseline HR: XX BPM"`.
  - **UX Interactive Tooltip:** Design a custom hover tooltip displaying: Timestamp, `Heart Rate: XX BPM`, `Stress Score: XX`, `SpO2: XX%`, and current stage with difficulty in parentheses, e.g., `Stage: Cruising (Medium)`.

#### User Story 5.4: Time in Range Distribution & Session Summary
- **Description:** As a therapist, I want a breakdown of the patient's stress zones in percentages and a quick macro summary grid.
- **Tasks:**
  - **FE Donut Chart (Time in Range):** Integrate a Recharts `PieChart` (with `innerRadius`) showing percentage distribution of stress levels relative to their baseline: `Relaxed` (Green), `Moderate` (Orange), `Panic` (Red).
  - **FE Session Summary Widgets:** Build a grid of 4 summary cards below the donut chart:
    1. `Total Data Points` (Raw count from watch/VR).
    2. `Time Windows` (Downsampled points rendered).
    3. `Average Stress` (Weighted average of the session).
    4. `Average SpO2` (Average oxygen level during the session).

#### User Story 5.5: Clinical Math Engine & Longitudinal Progression
- **Description:** As a therapist, I want the system to process advanced metrics, filter motion noise, and track multi-session recovery trends.
- **Tasks:**
  - **BE Motion Artifacts Filter:** Cross-reference sudden heart rate spikes with accelerometer data from the watch. If high acceleration matches a spike, flag it as a `"Motion Artifact"` on the chart rather than a clinical anxiety peak.
  - **BE HRV RMSSD Calculation:** Calculate the root mean square of successive differences (RMSSD) from the RR intervals at session completion and save it to the DB:
    $$RMSSD = \sqrt{\frac{1}{N-1}\sum_{i=1}^{N-1}(RR_{i+1}-RR_i)^2}$$
  - **FE Progression Bar Chart:** In the `Progression` tab, render a bar chart comparing performance metrics across multiple sessions (e.g., comparing peak stress during "Takeoff" from Session 1 to Session 10) to visualize desensitization.
  - **FE PDF Export Service:** Implement a secure "Download PDF Report" button inside the Progression tab that generates a clinical summary document with a clinic logo and a subtle watermark.

---

### Epic 6: Hardware Inventory & Kit Assignment
**Goal:** Complete separation between patient identity and physical devices, managing equipment "Kits", and routing asynchronous data streams to the correct active patient.

#### User Story 6.1: Hardware Provisioning & Kit Creation (Admin Inventory UI)
- **Description:** As an admin, I want to register devices (VR/Watch) and package them into "Kits" to manage inventory health and assign equipment as a single working unit.
- **DB:** Create `devices` table (`device_id` PK, `device_type` Enum, `status` Enum, `last_seen` Timestamp) and `kits` table (`kit_id` PK, `vr_device_id` FK, `watch_device_id` FK).
- **BE:** Implement `POST /api/v1/devices` and `POST /api/v1/kits` with validation preventing a device from being in multiple kits simultaneously.
- **BE:** Implement `PATCH /api/v1/kits/:id` for swapping a single broken device without deleting the kit.
- **FE:** Build Inventory Dashboard with "Registered Devices" and "Active Kits" tables, including status badges.
- **FE:** Create a Modal/Component for kit creation using available devices dropdowns.
- **UX Location:** Sidebar -> `🛡️ Admin -> 📦 Hardware Inventory`.

#### User Story 6.2: Patient-Kit Assignment Lifecycle (Onboarding Assignment)
- **Description:** As a clinician, I want to assign an available kit to a new patient during onboarding and release it when treatment ends.
- **DB:** Create `patient_assignments` ledger table (`assignment_id`, `patient_id`/`national_id`, `kit_id`, `assigned_at`, `unassigned_at` Nullable) with a Unique Index on active kits (`unassigned_at IS NULL`).
- **BE:** Implement `GET /api/v1/kits/available` querying kits without active assignments.
- **BE:** Implement `POST /api/v1/assign-kit` and `PATCH /api/v1/release-kit`. Protect National ID from modifications during this process.
- **FE:** Update Add Patient Wizard to include **Step 3: Equipment Assignment**.
- **FE:** Add a searchable Live Dropdown displaying available kits (e.g., "Kit #5 - Watch 4, Quest 2").
- **UX Location:** Sidebar -> `Clinical -> Add Patient -> Step 3: Equipment`.

🌟 [NEW] FE (Patient Profile - Active Equipment View):
* Add an "Active Equipment" card/section inside the first tab ("Personal Info") of the Patient Profile page.
* If the patient has an assigned kit: Display the kit details (Kit ID, VR Device ID, Watch Device ID) and the assignment date (`assigned_at`).
* If no kit is assigned: Display a clear message stating "No equipment currently assigned".

🌟 [NEW] FE (Release Kit Action):
* Inside the "Active Equipment" card (in the Personal Info tab), add a "Return Kit" button.
* Clicking the button will show a short Confirmation Modal to prevent accidental actions.
* Confirming the modal will trigger a call to `PATCH /api/v1/assignments/release` and update the UI in real-time (the kit will disappear from the profile).

🌟 [NEW] FE (Assign Kit to Existing Patient):
* If the patient does not have an assigned kit, display an "Assign Kit" button in the Active Equipment card.
* Clicking it will open a Modal with the same searchable dropdown of available kits (just like in Step 3 of the Wizard), allowing the therapist to assign a kit using `POST /api/v1/assignments/assign`. On success, the tab will refresh to display the newly assigned kit.

UX (UI Locations):
* Onboarding: Sidebar -> Clinical -> Add Patient -> Step 3: Kit Assignment.
* Lifecycle Management: Sidebar -> Clinical -> Patients -> Click on a patient (Patient Profile) -> Personal Info tab -> Active Equipment card.

#### User Story 6.3: Async Device-to-Patient Routing & Profile Management
- **Description:** As a system/clinician, I want to route incoming async device data to the correctly assigned patient and manage the equipment from the patient's profile.
- **BE:** Update Socket.io Handshake to validate `deviceId` against the `devices` table upon connection.
- **BE:** Develop a server Middleware to resolve the active patient's `national_id` from a given `deviceId` via SQL Joins.
- **BE:** Implement asynchronous data ingestion to PostgreSQL, attaching the correct `patient_id` even if VR and Watch streams arrive at different times.
- **BE:** Add logging/alerting for unassigned device streams sending data.
- **FE:** Add an "Assigned Equipment" Card in Patient Profile -> Personal Info tab.
- **FE:** Add a "Release Kit" button and a "Swap Device" feature directly inside the equipment card.
- **UX Location:** `Patient Profile -> Personal Info Tab -> Bottom Section`.

#### User Story 6.4: Kit Health & Real-time Connectivity Status
- **Description:** As a clinician, I want to see live connectivity and streaming status of the patient's devices.
- **BE:** Implement Heartbeat Tracker updating `last_seen` in the `devices` table upon receiving data/ping.
- **BE:** Setup a Background Job (e.g., via `node-cron`) to alert if an assigned kit hasn't sent data for over 48 hours.
- **FE:** Add permanent Watch and VR status icons in the Patient Profile Header.
- **FE:** Color icons green if active within last 5 mins, otherwise gray/red, with a hover Tooltip showing "Last seen: HH:MM".
- **UX Location:** `Patient Profile Header` (Visible across all tabs).

---

## Navigation Architecture & UI Components

### 1. Visual Sidebar Structure (LTR - Left-to-Right)
**👥 Clinical (Group):**
- **Patient List:** Includes Search by Name/ID and "View Record" access to comprehensive Patient Profile with integrated analytics.
- **Add Patient:** Form for new entries (US 2.1).

**🥽 Live Session (Group):** (Highlight visually when a VR session is active)
- **Active Monitor:** Real-time heart rate/VR telemetry (US 3.1).

**️ Admin (Owner Only):** Business-level data and system management
- **Team Management:** Manage therapists and staff (US 1.3).

**⚙️ Settings (Group):**
- **Change Password:** Personal security update.
- **Logout.**

### 2. Role-Based Routing Logic
- **Therapist Home Page:** After successful login (when `is_first_login` is false), redirect to **Patient List** (US 2.2).
- **Owner Home Page:** After successful login (when `is_first_login` is false), redirect to **Team Management** (US 1.3).
- **First Login Flow:** If `is_first_login` is true, force redirect to `/change-password` regardless of role.

### 3. Global Header Implementation
- **Connectivity Status:** Live icons for VR Headset and Smartwatch (Green: Connected / Red: Offline).
- **Panic State:** If high distress is detected (US 4.1), Header must flash Red across all pages.
- **Emergency Pop-up:** Shows 'Emergency' alert across ALL pages for the active therapist when distress is detected.
- **AI Feedback Loop:** Agree/Disagree buttons for AI recommendations in Live Session.

### 4. Core Logic & Task Refinement
- **Epic 1 (Security):** Remove 'Forgot Password'. If `is_first_login` is true, force redirect to `/change-password`. Successful change must trigger Auto-Logout.
- **Epic 2 (Patients):** Owner role must see all patients; Therapists see only their own. Add 'Status' field (Active/Pending/Closed). **Note:** All Patient Analytics features have been MOVED and INTEGRATED into the Patient Profile (3-tab structure) accessible via Clinical -> Patient List -> View Record.
- **Epic 3 (Real-Time):** Setup WebSocket/MQTT for live data. Sync Heart Rate to VR Timestamps. Implement real-time device status indicators.
- **Epic 4 (AI & Safety):** Compare HR to MedicalNorms (Age-based). Implement Emergency Stop logic. Add Therapist Feedback Loop (Agree/Disagree) to all AI recommendations. Global Panic Alert system.
- **Epic 5 (Analytics Integration):** All patient-specific analytics (Session Graphs, HRV/RMSSD, Distributions) are now integrated into Patient Profile -> Treatment History and Progression tabs. Technical requirements for Epic 4 (Safety Engine) and Epic 5 (Downsampling, HRV algorithms) are preserved and mapped to the new tab structure.

---

## Technical Implementation Plan (Current Focus)
1. Initialize PostgreSQL on port **5433**.
2. Run `schema.sql` to create `users` and `patients` tables.
3. Implement Auth Backend (JWT/Hashing) and Login UI.
4. Implement Owner "Team Management" flow.