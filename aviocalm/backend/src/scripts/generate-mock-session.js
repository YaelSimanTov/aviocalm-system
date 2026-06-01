/**
 * 15-Minute Mock Session Data Generator
 * ──────────────────────────────────────
 * Generates a complete, realistic 15-minute VR flight session with:
 *   - 180 biometric samples (one every 5 seconds)
 *   - Smooth VR phase transitions: Boarding → Takeoff → Cruising → Landing → Landed
 *   - Three deliberate anomaly windows that trigger all 3 alert types:
 *       Statistical : HR spike 43% above baseline during Cruising  (~6:40)
 *       Panic       : Sustained high HR + stress during Landing     (~11:00)
 *       Safety      : Absolute HR threshold breach during peak      (~11:30)
 *   - A patient_baselines calibration record
 *   - Proper session completion with HRV RMSSD approximation
 *
 * Usage (from the backend/ directory):
 *   node src/scripts/generate-mock-session.js <patient-uuid>
 *
 * If no patient UUID is supplied, the script lists all available patients.
 */

// Load .env before requiring the pool so DB credentials are in process.env
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const pool = require('../../config/db');

// ─── Constants ────────────────────────────────────────────────────────────────

const BASELINE_HR        = 75;  // Resting heart rate (BPM)
const BASELINE_STRESS    = 20;  // Resting stress score
const BASELINE_SPO2      = 98;  // Resting SpO2 (%)
const SAMPLE_INTERVAL_S  = 5;   // Seconds between biometric records
const TOTAL_DURATION_S   = 900; // 15 minutes in seconds
const TOTAL_SAMPLES      = TOTAL_DURATION_S / SAMPLE_INTERVAL_S; // 180 records

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a random integer in the inclusive range [min, max]. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Linear interpolation: returns the value at fractional position t ∈ [0, 1]. */
function lerp(from, to, t) {
  return from + (to - from) * t;
}

/**
 * Approximates HRV RMSSD from an array of heart-rate samples.
 * Converts each HR value to an R-R interval (ms = 60000/HR), then computes
 * the root mean square of successive differences — a standard HRV metric.
 */
function approximateRmssd(hrSamples) {
  const rr = hrSamples.map((hr) => 60000 / hr);
  let sumSq = 0;
  for (let i = 1; i < rr.length; i++) {
    sumSq += Math.pow(rr[i] - rr[i - 1], 2);
  }
  return Math.sqrt(sumSq / (rr.length - 1));
}

// ─── Data builder ─────────────────────────────────────────────────────────────

/**
 * Builds all 180 biometric data points for the 15-minute session.
 *
 * Phase timeline (seconds from session start):
 *   [0   – 120 ] BoardingState / Easy   — calm resting baseline
 *   [120 – 300 ] TakeOffState  / Medium — gradual HR and stress ramp-up
 *   [300 – 660 ] InFlightState / Hard   — sustained elevation; Statistical spike at 400–490 s
 *   [660 – 810 ] LandingState  / Hard   — peak anxiety; Panic from 660 s, Safety spike at 690–750 s
 *   [810 – 900 ] LandedState   / Easy   — recovery ramp-down
 *
 * @param {Date} sessionStart  - When the session started.
 * @returns {Array<{ts, vrState, difficulty, hr, stress, spo2}>}
 */
function buildDataPoints(sessionStart) {
  const points = [];

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const offsetS = i * SAMPLE_INTERVAL_S;
    const ts      = new Date(sessionStart.getTime() + offsetS * 1000);

    let vrState, difficulty, hr, stress, spo2;

    if (offsetS < 120) {
      // ── Boarding: calm resting baseline ──────────────────────────────────
      vrState    = 'BoardingState';
      difficulty = 'Easy';
      hr         = randInt(72, 79);
      stress     = randInt(14, 26);
      spo2       = randInt(97, 99);

    } else if (offsetS < 300) {
      // ── Takeoff: gradual ramp over 3 minutes ─────────────────────────────
      const t = (offsetS - 120) / 180; // 0 → 1
      vrState    = 'TakeOffState';
      difficulty = 'Medium';
      hr         = Math.round(lerp(78, 95, t)) + randInt(-3, 3);
      stress     = Math.round(lerp(25, 50, t)) + randInt(-4, 4);
      spo2       = randInt(96, 98);

    } else if (offsetS < 660) {
      // ── Cruising: elevated HR with a Statistical spike at 400–490 s ──────
      vrState    = 'InFlightState';
      difficulty = offsetS < 480 ? 'Medium' : 'Hard';

      // Statistical anomaly: HR 43% above baseline (108 vs 75 BPM)
      // Triggers the Statistical alert rule (threshold: >25% delta_hr_percent)
      const inStatSpike = offsetS >= 400 && offsetS < 490;
      hr     = inStatSpike ? randInt(103, 112) : randInt(85, 100) + randInt(-2, 2);
      stress = inStatSpike ? randInt(55, 68)   : randInt(38, 60)  + randInt(-3, 3);
      spo2   = randInt(95, 97);

    } else if (offsetS < 810) {
      // ── Landing: peak anxiety phase ───────────────────────────────────────
      vrState    = 'LandingState';
      difficulty = 'Hard';

      // Safety spike: HR > 130 BPM (absolute threshold) at 690–750 s
      // Also drops SpO2 to reflect physiological stress peak
      const inSafetySpike = offsetS >= 690 && offsetS < 750;
      hr     = inSafetySpike ? randInt(138, 148)                  : randInt(108, 128) + randInt(-4, 4);
      stress = randInt(68, 88) + randInt(-3, 3);
      spo2   = inSafetySpike ? randInt(91, 93)                    : randInt(93, 96);

    } else {
      // ── Landed: gradual recovery ramp-down over 90 seconds ────────────────
      const t = (offsetS - 810) / 90; // 0 → 1
      vrState    = 'LandedState';
      difficulty = 'Easy';
      hr         = Math.round(lerp(122, 82, t)) + randInt(-4, 4);
      stress     = Math.round(lerp(65, 24, t))  + randInt(-4, 4);
      spo2       = Math.round(lerp(93, 97, t))  + randInt(0, 1);
    }

    // Clamp all values to physiologically plausible bounds
    hr     = Math.max(50,  Math.min(hr,     160));
    stress = Math.max(0,   Math.min(stress, 100));
    spo2   = Math.max(85,  Math.min(spo2,   100));

    points.push({ ts, vrState, difficulty, hr, stress, spo2 });
  }

  return points;
}

/**
 * Returns the three alert records derived from the known anomaly windows.
 * Timestamps and durations mirror the data generation above so markers
 * align precisely with the visible spikes on the chart.
 *
 * @param {string} patientUuid  - patients.id (UUID)
 * @param {string} sessionId    - sessions.id (UUID)
 * @param {Date}   sessionStart
 */
function buildAlerts(patientUuid, sessionId, sessionStart) {
  const at = (sec) => new Date(sessionStart.getTime() + sec * 1000);

  return [
    {
      patient_id:       patientUuid,
      session_id:       sessionId,
      timestamp:        at(400),   // Statistical spike start (~6:40 into session)
      duration_seconds: 90,
      alert_type:       'Statistical',
      description:      'Heart rate elevated 43% above resting baseline (108 BPM vs baseline 75 BPM). Relative statistical threshold exceeded during cruising phase.',
    },
    {
      patient_id:       patientUuid,
      session_id:       sessionId,
      timestamp:        at(660),   // Panic onset at landing start (11:00)
      duration_seconds: 150,
      alert_type:       'Panic',
      description:      'Sustained panic state: HR 118 BPM with stress score 78 maintained for over 2 minutes during landing phase.',
    },
    {
      patient_id:       patientUuid,
      session_id:       sessionId,
      timestamp:        at(690),   // Safety spike (~11:30)
      duration_seconds: 60,
      alert_type:       'Safety',
      description:      'Critical safety threshold exceeded: HR reached 142 BPM (absolute limit: 130 BPM). Immediate therapist intervention recommended.',
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const patientUuid = process.argv[2];

  if (!patientUuid) {
    // List patients so the caller can pick a UUID
    const { rows } = await pool.query(
      `SELECT id, national_id, full_name FROM patients ORDER BY full_name LIMIT 20`
    );
    if (rows.length === 0) {
      console.log('\nNo patients found in the database.\n');
    } else {
      console.log('\nAvailable patients (pass the UUID as the first argument):\n');
      rows.forEach((p) =>
        console.log(`  ${p.id}  |  ${p.full_name.padEnd(30)}  (${p.national_id})`)
      );
      console.log('\nUsage: node src/scripts/generate-mock-session.js <patient-uuid>\n');
    }
    await pool.end();
    return;
  }

  // 1. Resolve patient ─────────────────────────────────────────────────────────
  const patientRes = await pool.query(
    `SELECT id, national_id, full_name FROM patients WHERE id = $1`,
    [patientUuid]
  );
  if (patientRes.rows.length === 0) {
    console.error(`\nPatient not found: ${patientUuid}\n`);
    await pool.end();
    process.exit(1);
  }
  const { id: patientId, national_id: nationalId, full_name: fullName } = patientRes.rows[0];
  console.log(`\nGenerating 15-minute mock session for: ${fullName} (${nationalId})`);

  const sessionStart = new Date();

  // 2. Create session ───────────────────────────────────────────────────────────
  const sessionRes = await pool.query(
    `INSERT INTO sessions (patient_id, started_at, status)
     VALUES ($1, $2, 'In Progress')
     RETURNING id`,
    [patientId, sessionStart]
  );
  const sessionId = sessionRes.rows[0].id;
  console.log(`  Session created : ${sessionId}`);

  // 3. Insert calibrated patient baseline ──────────────────────────────────────
  await pool.query(
    `INSERT INTO patient_baselines (patient_id, session_id, avg_resting_hr, avg_resting_stress)
     VALUES ($1, $2, $3, $4)`,
    [patientId, sessionId, BASELINE_HR, BASELINE_STRESS]
  );
  console.log(`  Baseline saved  : HR ${BASELINE_HR} BPM, Stress ${BASELINE_STRESS}`);

  // 4. Generate and bulk-insert 180 anxiety_profile records ────────────────────
  const dataPoints = buildDataPoints(sessionStart);

  // Build a single parameterised bulk INSERT for all 180 rows.
  // anxiety_profiles.patient_id references patients.national_id (VARCHAR), not UUID.
  const cols = `(patient_id, session_id, recorded_at, vr_state, difficulty, heart_rate, stress_score, spo2)`;
  const values = [];
  const rows = dataPoints.map((pt, i) => {
    const b = i * 8; // parameter offset for this row
    values.push(nationalId, sessionId, pt.ts, pt.vrState, pt.difficulty, pt.hr, pt.stress, pt.spo2);
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`;
  });
  await pool.query(
    `INSERT INTO anxiety_profiles ${cols} VALUES ${rows.join(',')}`,
    values
  );
  console.log(`  Biometric data  : ${dataPoints.length} records inserted`);

  // 5. Insert the 3 alert records ───────────────────────────────────────────────
  const alerts = buildAlerts(patientId, sessionId, sessionStart);
  for (const a of alerts) {
    await pool.query(
      `INSERT INTO alerts (patient_id, session_id, timestamp, duration_seconds, alert_type, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [a.patient_id, a.session_id, a.timestamp, a.duration_seconds, a.alert_type, a.description]
    );
  }
  console.log(`  Alerts inserted : Statistical, Panic, Safety`);

  // 6. Complete the session ─────────────────────────────────────────────────────
  const endedAt = new Date(sessionStart.getTime() + TOTAL_DURATION_S * 1000);
  const rmssd   = approximateRmssd(dataPoints.map((p) => p.hr)).toFixed(2);
  await pool.query(
    `UPDATE sessions
     SET ended_at = $1, duration_minutes = 15, status = 'Completed', overall_hrv_rmssd = $2
     WHERE id = $3`,
    [endedAt, rmssd, sessionId]
  );
  console.log(`  Session closed  : HRV RMSSD ≈ ${rmssd} ms`);

  console.log(`\n✓  Done. Open the patient's Treatment History and look for the session at:`);
  console.log(`   /patients/${patientId}/sessions/${sessionId}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  pool.end();
  process.exit(1);
});
