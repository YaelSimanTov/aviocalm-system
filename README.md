<div align="center">

# ✈️ AvioCalm

### Real-Time Biometric VR Exposure Therapy for Aviophobia

[![Node.js](https://img.shields.io/badge/Node.js-v22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![Unity](https://img.shields.io/badge/Unity-VR-000000?style=flat-square&logo=unity&logoColor=white)](https://unity.com)
[![Wear OS](https://img.shields.io/badge/Wear%20OS-Samsung%20Galaxy%20Watch-4285F4?style=flat-square&logo=wearos&logoColor=white)](https://wearos.google.com)

*A clinical-grade system that synchronizes live physiological data from a Samsung Galaxy Watch with a Unity VR flight simulation, giving therapists real-time biometric insight during Exposure Therapy sessions.*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [System Architecture & Flow](#-system-architecture--flow)
- [Key Engineering Features](#-key-engineering-features)
- [Tech Stack](#-tech-stack)
- [Related Repositories](#-related-repositories)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#1-database-setup)
  - [Backend Setup](#2-backend-setup)
  - [Frontend Setup](#3-frontend-setup)
- [Hardware Connection via ngrok](#-hardware-connection-via-ngrok)
- [User Roles](#-user-roles)
- [API Overview](#-api-overview)
- [Database Schema](#-database-schema)

---

## 🧠 Overview

**AvioCalm** is a full-stack, real-time biometric therapy platform designed for clinical treatment of **Aviophobia** (fear of flying). It bridges three distinct hardware and software environments into a single, cohesive therapeutic workflow:

1. **Wear OS Smartwatch** — Continuously streams raw Heart Rate (HR), Inter-Beat Interval (IBI) data, and SpO₂ readings from the patient's Samsung Galaxy Watch.
2. **Unity VR Headset** — Immerses the patient in a graduated flight simulation, emitting contextual scene-change events.
3. **React Therapist Dashboard** — Displays fused, real-time biometric charts with automated clinical alerts, allowing the therapist to monitor and intervene without breaking session immersion.

The backend is the central nervous system: it ingests raw hardware streams, performs on-the-fly signal processing, and pushes computed metrics to the dashboard over a persistent WebSocket connection.

---

## 🏗 System Architecture & Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AvioCalm System                                │
│                                                                          │
│  ┌──────────────┐        ┌───────────────────────────────────────────┐  │
│  │  Samsung     │  HTTP  │              Node.js Backend               │  │
│  │  Galaxy      │ ──────▶│  ┌─────────────────────────────────────┐  │  │
│  │  Watch       │  POST  │  │         Signal Processing            │  │  │
│  │  (Wear OS)   │        │  │  IBI Data ──▶ RMSSD ──▶ Stress Score │  │  │
│  └──────────────┘        │  │         Moving Avg (window=7)        │  │  │
│                           │  └──────────────┬──────────────────────┘  │  │
│  ┌──────────────┐        │                 │                           │  │
│  │  Unity VR    │  HTTP  │  ┌──────────────▼──────────────────────┐  │  │
│  │  Headset     │ ──────▶│  │         Rule Engine (3-Layer)        │  │  │
│  │  (Scene      │ Events │  │  Layer 1: Absolute Safety            │  │  │
│  │   Events)   │        │  │  Layer 2: Statistical (Z-Score)      │  │  │
│  └──────────────┘        │  │  Layer 3: Combined Panic             │  │  │
│                           │  └──────────────┬──────────────────────┘  │  │
│                           │                 │  Socket.IO               │  │
│                           └─────────────────┼───────────────────────┘  │
│                                             │                           │
│                           ┌─────────────────▼───────────────────────┐  │
│                           │         React Therapist Dashboard         │  │
│                           │  Live HRV Charts │ Alerts │ Session Log  │  │
│                           └─────────────────────────────────────────┘  │
│                                                                          │
│                           ┌──────────────────────────────────────────┐  │
│                           │           PostgreSQL Database              │  │
│                           │  Sessions │ Alerts │ Baselines │ Profiles  │  │
│                           └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. The **Wear OS app** POSTs a batch of IBI values and SpO₂ readings to the backend every second.
2. The **backend** passes raw IBI data through `SignalProcessingService` (moving-average smoothing) and then `HRV Calculator` (RMSSD → Stress Score 0–100).
3. Simultaneously, the **Unity VR headset** POSTs scene-transition events that are merged with the biometric stream in the Node.js event loop — no blocking locks required.
4. The **Rule Engine** evaluates the smoothed metrics against a patient-specific calibrated baseline and fires alerts through three independent safety channels.
5. All derived metrics and alerts are broadcast over **Socket.IO** to the therapist dashboard and persisted to **PostgreSQL**.

---

## ⚙️ Key Engineering Features

### 1. Real-Time HRV & RMSSD Stress Calculation
The `hrv-calculator.js` service computes stress from raw **IBI (Inter-Beat Interval)** data using the clinically validated **RMSSD** (Root Mean Square of Successive Differences) algorithm. IBI values are filtered to the physiologically valid range (300–1500 ms / 40–200 BPM) before processing. The resulting RMSSD is inverted and normalized into a **0–100 Stress Score**, where lower HRV maps to higher stress.

### 2. Smart Rule Engine — 3-Layer Alert Architecture
The `rule-engine.js` / `safety-engine.js` pair implements a **three independent channel** monitoring system to avoid both missed events and alert fatigue:

| Layer | Channel | Trigger Mechanism |
|---|---|---|
| **1 — Safety** | `absoluteSafety` | Hard medical threshold breach (e.g., HR > 120 BPM, SpO₂ < 90%) |
| **2 — Statistical** | `relativeSafety` | Z-score deviation ≥ 2.0σ above the patient's personal calibrated baseline |
| **3 — Panic** | `combinedPanic` | Simultaneous breach of both Safety and Statistical channels |

A **calibration window** (first N samples) establishes each patient's resting HR/Stress baseline before any rules are evaluated — eliminating cold-start false positives. Alerts are only persisted if a breach lasts longer than a configurable `duration_threshold` pulled from `medical_norms`.

### 3. IQR Outlier Filter (Artifact Rejection)
The signal processing pipeline applies an **Interquartile Range (IQR)** filter on the incoming IBI stream to discard physiologically implausible spikes caused by movement artifacts or sensor dropout, preventing transient hardware noise from triggering clinical alerts.

### 4. Lock-Free Async Stream Synchronization
VR scene-change events and Watch biometric payloads arrive on different HTTP endpoints at different rates. Rather than using mutexes or shared locks, the backend merges both streams using the **Node.js single-threaded event loop** as a natural serialization mechanism — providing race-condition-free fusion with zero blocking overhead.

### 5. Time-Weighted Data Downsampling (Bucketing)
To keep the React chart rendering smooth regardless of data volume, the analytics routes implement **time-weighted bucketing**: the raw time-series is divided into fixed-duration buckets, and each bucket is collapsed into a single weighted-average data point. This ensures the `<Recharts>` components always receive a constant-density series, even for long sessions.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Node.js + Express.js v5 |
| **Real-Time Transport** | Socket.IO v4 |
| **Authentication** | JWT (`jsonwebtoken`) + `bcrypt` |
| **Input Validation** | Joi v17 |
| **Frontend Framework** | React v19 + Vite v7 |
| **UI Styling** | Tailwind CSS v4 |
| **Charts** | Recharts v3 + Chart.js v4 |
| **Icons** | Lucide React |
| **Routing** | React Router DOM v7 |
| **Database** | PostgreSQL v15+ (`pg` pool) |
| **VR Platform** | Unity (C#) |
| **Smartwatch** | Samsung Galaxy Watch — Wear OS / Android Studio |
| **Tunnel (Dev)** | ngrok |

---

## 🔗 Related Repositories

The AvioCalm system spans multiple repositories. The hardware client applications that communicate with this backend are maintained separately:

| Component | Repository |
|---|---|
| **Unity VR Application** | [YaelSimanTov/aviocalm-unity](https://github.com/YaelSimanTov/aviocalm-unity) |
| **Wear OS Smartwatch Application** | [YaelSimanTov/aviocalm-smart-watch](https://github.com/YaelSimanTov/aviocalm-smart-watch) |

---

## 📁 Project Structure

```
aviocalm/
├── backend/
│   └── src/
│       ├── server.js               # Express app, Socket.IO setup, all route mounting
│       ├── config/
│       │   └── db.js               # PostgreSQL pool configuration
│       ├── controllers/
│       │   ├── auth-controller.js
│       │   ├── patients-controller.js
│       │   ├── alerts-controller.js
│       │   ├── assignment-controller.js
│       │   └── inventory-controller.js
│       ├── routes/
│       │   ├── auth-routes.js
│       │   ├── patients-routes.js
│       │   ├── alerts-routes.js
│       │   ├── analytics-routes.js
│       │   ├── assignment-routes.js
│       │   ├── inventory-routes.js
│       │   └── owner-routes.js
│       ├── services/
│       │   ├── hrv-calculator.js           # RMSSD stress score from IBI
│       │   ├── signal-processing-service.js # Moving average + IQR filter
│       │   ├── rule-engine.js              # 3-layer alert orchestrator
│       │   ├── safety-engine.js            # Channel state machine
│       │   ├── clinical-scoring-service.js
│       │   ├── assignment-service.js
│       │   ├── inventory-service.js
│       │   └── device-resolver.js
│       ├── db/
│       │   ├── schema.sql                  # Full PostgreSQL schema
│       │   ├── db-manager.js
│       │   └── migrations/
│       ├── middleware/
│       ├── mocks/
│       └── sockets/
│           └── calibrationHandler.js
└── frontend/
    └── src/
        ├── App.jsx
        ├── pages/
        │   ├── login-page.jsx
        │   ├── patient-list.jsx
        │   ├── owner-dashboard.jsx
        │   └── ...
        ├── components/
        ├── context/
        ├── layouts/
        └── utils/
```

---

## 🚀 Getting Started

### Prerequisites

Ensure the following are installed on your development machine:

- [Node.js](https://nodejs.org) v22+
- [PostgreSQL](https://www.postgresql.org/download/) v15+
- [ngrok](https://ngrok.com/download) (free account required for static domain)
- [Git](https://git-scm.com)

---

### 1. Database Setup

Connect to your PostgreSQL instance and create the database:

```sql
CREATE DATABASE aviocalm;
```

> **Note:** The backend expects PostgreSQL to be running on **port 5433**. If your instance uses the default port 5432, update `DB_PORT` in your `.env` file accordingly.

Apply the full schema from the project root:

```powershell
psql -U postgres -d aviocalm -f aviocalm\backend\src\db\schema.sql
```

---

### 2. Backend Setup

Navigate to the backend directory, install dependencies, and configure environment variables:

```powershell
cd aviocalm\backend
npm install
```

Copy the example file and fill in your values:

```powershell
copy aviocalm\backend\.env.example aviocalm\backend\.env
```

Then edit `aviocalm/backend/.env`:

```env
# Server
PORT=5000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5433
DB_NAME=aviocalm
DB_USER=your_pg_username
DB_PASSWORD=your_pg_password

# Authentication
JWT_SECRET=your_super_secret_jwt_key

# ngrok Public URL (set after starting tunnel — see Hardware Connection section)
NGROK_URL=https://<your-custom-domain>.ngrok-free.dev
```

Start the backend server:

```powershell
npm run dev
```

The API will be available at `http://localhost:5000`.

---

### 3. Frontend Setup

Navigate to the frontend directory, install dependencies, and configure environment variables:

```powershell
cd aviocalm\frontend
npm install
```

Copy the example file and fill in your values:

```powershell
copy aviocalm\frontend\.env.example aviocalm\frontend\.env
```

Then edit `aviocalm/frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Start the development server:

```powershell
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## 🔌 Hardware Connection via ngrok

The **Samsung Galaxy Watch** (Wear OS app) and the **Unity VR headset** are physical devices that cannot reach `localhost` on your development machine. To solve this, we use **ngrok** to expose the local backend server to the public internet through a fixed static domain.

### Start the Tunnel

In a **separate PowerShell terminal**, run:

```powershell
ngrok http 5000 --domain=<your-custom-domain>.ngrok-free.dev
```

This will produce output similar to:

```
Session Status   online
Account          your-account@email.com
Version          3.x.x
Region           United States (us)
Forwarding       https://<your-custom-domain>.ngrok-free.dev -> http://localhost:5000
```

### Configure the Hardware Clients

Once the tunnel is running, update the backend URL in **both** hardware clients to point to the ngrok domain:

| Client | Setting | Value |
|---|---|---|
| **Wear OS App** | Backend API Base URL | `https://<your-custom-domain>.ngrok-free.dev` |
| **Unity VR Project** | Backend API Base URL | `https://<your-custom-domain>.ngrok-free.dev` |

> ⚠️ **Never put real secrets directly in source files or commit `.env` files.** Both `.env` files are listed in `.gitignore` and will never be tracked. The repository ships `.env.example` templates — copy them to `.env` and fill in your real values locally. The ngrok domain above belongs in your local `.env`, not hardcoded anywhere in the codebase.

### Full Local Development Startup Order

For a complete local session with hardware, start processes in this order:

```
1.  PostgreSQL              → already running as a service
2.  ngrok tunnel            → ngrok http 5000 --domain=<your-custom-domain>.ngrok-free.dev
3.  Backend                 → npm run dev  (inside aviocalm/backend)
4.  Frontend                → npm run dev  (inside aviocalm/frontend)
5.  Unity VR headset        → deploy/run build pointing to ngrok URL
6.  Wear OS Watch app       → deploy/run build pointing to ngrok URL
```

---

## 👥 User Roles

The system supports two authenticated roles, both managed via JWT:

| Role | Capabilities |
|---|---|
| **Owner** | Manage therapist accounts, view clinic-wide analytics, manage device inventory (kits) |
| **Therapist** | Manage assigned patients, start/monitor VR sessions, review session history and alerts |

---

## 📡 API Overview

All endpoints are prefixed with the base URL (e.g., `http://localhost:5000`).

| Route Group | Prefix | Description |
|---|---|---|
| Authentication | `/api/auth` | Login, password change |
| Patients | `/api/patients` | CRUD for patient profiles |
| Sessions & Analytics | `/api/analytics` | Session data, HRV time-series, downsampled charts |
| Alerts | `/api/alerts` | Retrieve and acknowledge clinical alerts |
| Assignments | `/api/assignments` | Link patients to therapy kits |
| Inventory | `/api/inventory` | Kit and device management |
| Owner | `/api/owner` | Admin-level therapist and clinic management |

Real-time events are delivered over **Socket.IO** on the same port (5000). The frontend connects using `socket.io-client` and subscribes to session-namespaced events for live biometric updates and alert pushes.

---

## 🗄 Database Schema

The PostgreSQL schema covers the following core entities:

```
users               → Therapists and Owners (JWT auth)
patients            → Patient profiles, phobia metadata, emergency contacts
sessions            → VR therapy sessions with pre-computed KPI columns
vr_events           → Raw scene-change events from the Unity headset
alerts              → Triggered clinical alerts with breach duration and type
scene_stress_scores → Per-scene aggregated stress metrics
anxiety_profiles    → Patient anxiety baseline profiles
clinical_notes      → Therapist session annotations
medical_norms       → Age/condition-based rule thresholds for the Rule Engine
patient_baselines   → Calibrated resting-state baselines per patient
appointments        → Scheduled therapy appointment records
kits                → Physical hardware kit inventory
devices             → Individual device records (VR headset, smartwatch)
```

---

<div align="center">

**AvioCalm** — *Bridging clinical psychology, wearable hardware, and immersive VR into a single therapeutic platform.*

</div>
