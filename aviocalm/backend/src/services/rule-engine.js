/**
 * Rule Engine — US 4.1: Smart Alerts & Clinical Annotations
 *
 * Orchestrates per-session signal processing, calibration baseline collection,
 * multi-channel rule evaluation, and persistent alert creation.
 *
 * Architecture:
 *   - Per-session state: each active session owns a dedicated SignalProcessingService
 *     and SafetyEngine instance so concurrent remote sessions never share windows.
 *   - Calibration window: the first BASELINE_WINDOW_SECONDS samples establish the
 *     patient's personal resting HR/stress; rule evaluation is suppressed until then.
 *   - Breach lifecycle: when a channel opens, the start timestamp is recorded.  When
 *     the channel clears, duration_seconds is calculated and the alert is persisted
 *     only if duration >= duration_threshold from medical_norms.
 *   - Session finalization: any breach still open when the VR device disconnects is
 *     closed and persisted with its actual duration.
 */

const pool                        = require('../config/db');
const { SignalProcessingService } = require('./signal-processing-service');
const { SafetyEngine }            = require('./safety-engine');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Number of leading samples used purely for calibration.
// Set to 10 so the 60-second simulation can demonstrate alerts;
// change to 180 (3 minutes) for production deployments.
const BASELINE_WINDOW_SECONDS = 10;

// Maps SafetyEngine channel keys to the alert_type enum stored in the DB
const CHANNEL_ALERT_TYPE = {
  absoluteSafety: 'Safety',
  relativeSafety: 'Statistical',
  combinedPanic:  'Panic',
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-session registry and medical norms cache
// ─────────────────────────────────────────────────────────────────────────────

// sessionId -> { signalProcessor, safetyEngine, sampleCount,
//               baselineSamples, baseline, openBreaches }
const sessionRegistry = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Age helpers
// ─────────────────────────────────────────────────────────────────────────────

// Calculates a person's current age in whole years from their date_of_birth.
function calculateAge(dateOfBirth) {
  const today = new Date();
  const dob   = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Maps a numeric age to the medical_norms.age_group enum value stored in the DB.
function ageToAgeGroup(age) {
  if (age <= 25) return '18-25';
  if (age <= 40) return '26-40';
  if (age <= 60) return '41-60';
  return '60+';
}

// Queries the patients table for the patient's DOB, calculates their age, maps
// it to the correct age_group bracket, then fetches and returns the matching
// medical_norms row.  Returns null when no matching row is found.
// Norms are cached inside the per-session state object (not as a module singleton)
// so concurrent sessions for patients of different ages each get the right values.
async function fetchNormsForPatient(patientUuid) {
  const { rows: patientRows } = await pool.query(
    'SELECT date_of_birth FROM patients WHERE id = $1',
    [patientUuid]
  );

  let ageGroup = '26-40'; // safe fallback when DOB is unavailable
  if (patientRows.length && patientRows[0].date_of_birth) {
    const age = calculateAge(patientRows[0].date_of_birth);
    ageGroup  = ageToAgeGroup(age);
    console.log(`[RULE ENGINE] Patient ${patientUuid} — age: ${age} → age group: '${ageGroup}'`);
  } else {
    console.warn(`[RULE ENGINE] No date_of_birth for patient ${patientUuid}; defaulting to age group '${ageGroup}'`);
  }

  console.log(`[RULE ENGINE] Fetching medical norms from DB (${ageGroup} age group)...`);
  const { rows } = await pool.query(
    'SELECT * FROM medical_norms WHERE age_group = $1 LIMIT 1',
    [ageGroup]
  );

  const norms = rows[0] || null;
  if (norms) {
    console.log(`[RULE ENGINE] Medical norms loaded for '${ageGroup}': HR_Max=${norms.max_heart_rate}, SpO2_Min=${norms.spo2_min}, Stress_Max=${norms.stress_max}, Duration=${norms.duration_threshold}s, Delta=${norms.delta_hr_percent}%`);
  } else {
    console.error(`[RULE ENGINE] WARNING — medical_norms table returned 0 rows for age_group '${ageGroup}'. Alerts will NOT fire.`);
  }
  return norms;
}

function getOrCreateSessionState(sessionId) {
  if (!sessionRegistry.has(sessionId)) {
    // Pass a no-op io to SafetyEngine: in async remote mode alerts go to DB,
    // not to live sockets.  The existing TERMINATE emission is suppressed here.
    const noopIo = { emit: () => {} };

    sessionRegistry.set(sessionId, {
      signalProcessor: new SignalProcessingService(5),  // 5-point moving-average window
      safetyEngine:    new SafetyEngine(noopIo),
      sampleCount:     0,
      baselineSamples: { hr: [], stress: [] },
      baseline:        null,
      openBreaches:    new Map(),  // channelKey -> breach metadata
      norms:           null,       // cached per-session after first DOB lookup
      patientUuid:     null,       // stored so finalizeSession can resolve norms
    });
  }
  return sessionRegistry.get(sessionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function persistBaseline(patientId, sessionId, avgHr, avgStress) {
  console.log(`[RULE ENGINE] Inserting baseline — patient_id: ${patientId}, session_id: ${sessionId}, avgHr: ${avgHr.toFixed(2)}, avgStress: ${avgStress.toFixed(2)}`);
  try {
    await pool.query(
      `INSERT INTO patient_baselines (patient_id, session_id, avg_resting_hr, avg_resting_stress)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id) DO UPDATE
         SET avg_resting_hr    = EXCLUDED.avg_resting_hr,
             avg_resting_stress = EXCLUDED.avg_resting_stress`,
      [patientId, sessionId, avgHr, avgStress]
    );
    console.log(`[RULE ENGINE] Baseline persisted OK — session ${sessionId}: HR=${avgHr.toFixed(1)} BPM, Stress=${avgStress.toFixed(1)}`);
  } catch (err) {
    console.error(`[RULE ENGINE] FAILED to persist baseline — ${err.message}`);
    console.error(err.stack);
  }
}

async function persistAlert(patientId, sessionId, startTime, durationSeconds, alertType, description) {
  console.log(`[RULE ENGINE] >>> INSERT alert — patient_id: ${patientId} | session_id: ${sessionId} | type: ${alertType} | duration: ${durationSeconds}s | start: ${startTime.toISOString()}`);
  console.log(`[RULE ENGINE] >>> description: "${description}"`);
  try {
    const result = await pool.query(
      `INSERT INTO alerts
         (patient_id, session_id, timestamp, duration_seconds, alert_type, description, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id`,
      [patientId, sessionId, startTime, durationSeconds, alertType, description]
    );
    console.log(`[RULE ENGINE] <<< Alert INSERT OK — row id: ${result.rows[0].id} | [${alertType}] ${durationSeconds}s`);
  } catch (err) {
    console.error(`[RULE ENGINE] <<< Alert INSERT FAILED — ${err.message}`);
    console.error(`[RULE ENGINE]     params: patient_id=${patientId}, session_id=${sessionId}, alertType=${alertType}`);
    console.error(err.stack);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Breach tracking helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildAlertDescription(channelKey, channelResult) {
  const m = channelResult.metrics || {};

  if (channelKey === 'absoluteSafety') {
    const triggers = (channelResult.triggeredBy || []).join(', ');
    return `Absolute safety threshold crossed: ${triggers}`;
  }

  if (channelKey === 'relativeSafety') {
    const current  = Math.round(m.heartRate  || 0);
    const baseline = Math.round(m.baselineHR || 0);
    const delta    = m.deltaPercent || 0;
    const zPart    = m.zScore != null ? ` | Z-Score: ${m.zScore}` : '';
    return `Heart rate spike above personal baseline: ${current} BPM vs baseline ${baseline} BPM (threshold: +${delta}%${zPart})`;
  }

  if (channelKey === 'combinedPanic') {
    const stress = Math.round(m.stressScore || 0);
    const hr     = Math.round(m.heartRate   || 0);
    return `Panic state detected: stress score ${stress}/100 with consistently rising heart rate (HR: ${hr} BPM)`;
  }

  return 'Anomaly detected';
}

async function trackChannel(state, channelKey, channelResult, patientId, sessionId, now, norms) {
  if (channelResult.isActive) {
    // Open a new breach record if this channel is not already breaching
    if (!state.openBreaches.has(channelKey)) {
      const desc = buildAlertDescription(channelKey, channelResult);
      state.openBreaches.set(channelKey, {
        startTime:   now,
        patientId,
        alertType:   CHANNEL_ALERT_TYPE[channelKey],
        description: desc,
      });
      console.log(`[RULE ENGINE] *** Breach OPENED — channel: ${channelKey} | type: ${CHANNEL_ALERT_TYPE[channelKey]} | at: ${now.toISOString()}`);
      console.log(`[RULE ENGINE]     description: "${desc}"`);
    }
  } else {
    // Channel cleared: calculate duration and persist if it meets the threshold
    if (state.openBreaches.has(channelKey)) {
      const breach          = state.openBreaches.get(channelKey);
      const durationSeconds = Math.round((now.getTime() - breach.startTime.getTime()) / 1000);
      const meetsThreshold  = durationSeconds >= norms.duration_threshold;

      console.log(`[RULE ENGINE] *** Breach CLOSED — channel: ${channelKey} | duration: ${durationSeconds}s | threshold: ${norms.duration_threshold}s | will save: ${meetsThreshold}`);

      if (meetsThreshold) {
        await persistAlert(
          breach.patientId,
          sessionId,
          breach.startTime,
          durationSeconds,
          breach.alertType,
          breach.description
        );
      }

      state.openBreaches.delete(channelKey);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process one incoming vitals sample for a session.
 * Call this once per watch_vitals_update event, right after insertAnxietyProfile.
 *
 * @param {Object} params
 * @param {string} params.sessionId   - Active session UUID
 * @param {string} params.patientUuid - Patient UUID (PK in patients table)
 * @param {string} params.timestamp   - ISO timestamp string of the sample
 * @param {number} params.heartRate   - Raw heart rate in BPM
 * @param {number} params.stressScore - Raw stress score 0–100
 * @param {number} params.spo2        - Raw SpO2 percentage
 */
async function processVitalsSample({ sessionId, patientUuid, timestamp, heartRate, stressScore, spo2 }) {
  const state = getOrCreateSessionState(sessionId);
  state.sampleCount++;
  const n = state.sampleCount;

  // Step 1 — Apply Moving Average filter via SignalProcessingService
  const smoothed = state.signalProcessor.processRawMetrics({ heartRate, stressScore, spo2 });

  // Step 2 — Calibration phase: collect baseline samples, skip rule evaluation
  if (n <= BASELINE_WINDOW_SECONDS) {
    state.baselineSamples.hr.push(heartRate);
    state.baselineSamples.stress.push(stressScore);

    if (n === BASELINE_WINDOW_SECONDS) {
      const { hr: hrSamples, stress: stressSamples } = state.baselineSamples;
      const avgHr     = hrSamples.reduce((a, b) => a + b, 0)     / hrSamples.length;
      const avgStress = stressSamples.reduce((a, b) => a + b, 0) / stressSamples.length;

      // Population standard deviation of the calibration HR window.
      // Used by the Relative Statistical Channel to compute per-sample Z-Scores.
      // Population formula (divide by N, not N-1) is appropriate here because
      // the calibration window IS the full baseline population, not a sample of it.
      const hrVariance = hrSamples.reduce((sum, val) => sum + (val - avgHr) ** 2, 0) / hrSamples.length;
      const hrStdDev   = Math.sqrt(hrVariance);

      state.baseline = { hr: avgHr, stress: avgStress, hrStdDev };
      state.safetyEngine.setPatientBaseline({ avg_resting_hr: avgHr, avg_resting_stress: avgStress, hr_std_dev: hrStdDev });
      console.log(`[RULE ENGINE] Calibration complete — baseline HR=${avgHr.toFixed(1)}, Stress=${avgStress.toFixed(1)}, HR_StdDev=${hrStdDev.toFixed(2)}. Rule evaluation starts next sample.`);

      await persistBaseline(patientUuid, sessionId, avgHr, avgStress);
    }
    return;
  }

  // Step 3 — Load and cache medical norms for this patient (once per session).
  // Norms are stored in state.norms so each session resolves the correct age group
  // independently, which is required for correct behaviour in concurrent sessions.
  if (!state.patientUuid) state.patientUuid = patientUuid;
  if (!state.norms) {
    state.norms = await fetchNormsForPatient(patientUuid);
  }
  const norms = state.norms;
  if (!norms) {
    console.warn(`[RULE ENGINE] [EVAL ${n}] No medical norms — skipping`);
    return;
  }
  if (!state.safetyEngine.medicalNorms) {
    state.safetyEngine.setMedicalNorms(norms);
    console.log('[RULE ENGINE] Medical norms injected into SafetyEngine instance.');
  }

  // Step 4 — Run all 3 channels against the smoothed sample
  const evaluation = state.safetyEngine.evaluateSafety(smoothed);
  const now        = new Date(timestamp);
  const abs        = evaluation.channelResults.absoluteSafety;
  const rel        = evaluation.channelResults.relativeSafety;
  const pan        = evaluation.channelResults.combinedPanic;

  // Log every 10 samples to keep noise low without losing visibility
  if (n % 10 === 0) {
    console.log(
      `[RULE ENGINE] [EVAL ${n}] smoothed HR=${smoothed.heartRate} Stress=${smoothed.stressScore} SpO2=${smoothed.spo2} | ` +
      `abs=${abs.isActive ? 'BREACH' : 'ok'} rel=${rel.isActive ? 'BREACH' : 'ok'} panic=${pan.isActive ? 'BREACH' : 'ok'} | ` +
      `openBreaches: ${state.openBreaches.size}`
    );
  }

  // Step 5 — Update breach state; persist alert when a breach resolves
  await trackChannel(state, 'absoluteSafety', abs, patientUuid, sessionId, now, norms);
  await trackChannel(state, 'relativeSafety', rel, patientUuid, sessionId, now, norms);
  await trackChannel(state, 'combinedPanic',  pan, patientUuid, sessionId, now, norms);
}

/**
 * Finalize a session: flush any still-open breaches to DB, then remove session
 * state from the registry.  Call this when the VR device disconnects.
 *
 * @param {string} sessionId - UUID of the session being completed
 */
async function finalizeSession(sessionId) {
  console.log(`[RULE ENGINE] finalizeSession called — session: ${sessionId}`);
  const state = sessionRegistry.get(sessionId);
  if (!state) {
    console.log(`[RULE ENGINE] No session state found for ${sessionId} — nothing to finalize`);
    return;
  }

  console.log(`[RULE ENGINE] Finalizing session ${sessionId} — ${state.openBreaches.size} open breach(es), ${state.sampleCount} total samples`);

  // Use the norms already resolved for this session; fall back to a fresh lookup
  // only if the session never received any vitals samples (edge case).
  const norms = state.norms || await fetchNormsForPatient(state.patientUuid);
  const now   = new Date();

  for (const [channelKey, breach] of state.openBreaches) {
    const durationSeconds = Math.round((now.getTime() - breach.startTime.getTime()) / 1000);
    const meetsThreshold  = norms && durationSeconds >= norms.duration_threshold;
    console.log(`[RULE ENGINE] Flushing open breach — channel: ${channelKey} | duration: ${durationSeconds}s | will save: ${meetsThreshold}`);
    if (meetsThreshold) {
      await persistAlert(
        breach.patientId,
        sessionId,
        breach.startTime,
        durationSeconds,
        breach.alertType,
        breach.description
      );
    }
  }

  sessionRegistry.delete(sessionId);
  console.log(`[RULE ENGINE] Session ${sessionId} finalized and removed from registry`);
}

module.exports = { processVitalsSample, finalizeSession };
