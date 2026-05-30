/**
 * Full Session Simulation Script - Continuous 60-Second Telemetry
 * Generates 60 distinct data points with 4 flight stages to populate
 * the Session Analytics chart with realistic colored background regions.
 *
 * Architecture:
 *   - setInterval (1s) owns the vitals loop — 60 continuous ticks
 *   - setTimeout owns stage transitions — fires independently at exact times
 *   - Drift function produces natural physiological fluctuation each second
 *
 * Usage: node scripts/simulate-full-session.js
 */

const { io } = require('socket.io-client');

// ============================================================
// PASTE YOUR DEVICE IDs HERE (both must belong to the same kit)
const VR_DEVICE_ID    = '123';
const WATCH_DEVICE_ID = '12345';
// ============================================================

const SERVER_URL          = 'http://localhost:5000';
const SESSION_DURATION_MS = 60000; // Total session length
const VITALS_INTERVAL_MS  = 1000;  // One vitals update per second

/**
 * Stage definitions. Each stage fires at triggerMs after simulation start.
 * difficulty: null means no difficulty change is emitted for that stage.
 *
 * Alert-generation design:
 *   T=0–11s   Calm boarding — Rule Engine collects the 10-second baseline (HR≈72, Stress≈25).
 *   T=12–47s  Hard TakeOff danger phase — HR spikes to 145 BPM, Stress to 85, SpO2 drops to
 *             88%. This breaches all 3 rule-engine channels simultaneously for ≈36 seconds,
 *             which exceeds the medical_norms duration_threshold of 30 s and guarantees that
 *             Safety, Statistical and Panic alerts are persisted to the alerts table.
 *   T=48–59s  Recovery — metrics return to safe range, closing all open breaches.
 */
const STAGES = [
    { triggerMs: 0,     state: 'BoardingState', difficulty: 'Easy', targetHr: 72,  targetStress: 25, spo2Base: 98 },
    { triggerMs: 12000, state: 'TakeOffState',  difficulty: 'Hard', targetHr: 145, targetStress: 85, spo2Base: 88 },
    { triggerMs: 48000, state: 'InFlightState', difficulty: 'Easy', targetHr: 78,  targetStress: 30, spo2Base: 97 },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drifts a value toward a target each tick with small random noise.
 * Simulates natural physiological variation (not a flat line).
 * @param {number} current - Current value
 * @param {number} target - Target value to converge toward
 * @param {number} jitter - Max random noise per tick
 * @returns {number}
 */
function drift(current, target, jitter = 3) {
    const pull   = (target - current) * 0.25; // Converge at 25% per tick
    const noise  = (Math.random() * 2 - 1) * jitter;
    return Math.round(current + pull + noise);
}

/**
 * Creates and returns a socket.io client with standard event listeners
 * @param {string} deviceId - Device UUID passed in handshake query
 * @param {string} label - Display label for log output
 * @returns {Socket}
 */
function createSocket(deviceId, label) {
    const socket = io(SERVER_URL, {
        query: { deviceId },
        transports: ['websocket'],
    });
    socket.on('connect',       () => console.log(`[${label}] Connected — socket ID: ${socket.id}`));
    socket.on('connect_error', (err) => console.error(`[${label}] Connection error: ${err.message}`));
    socket.on('distress_alert', (v) => { if (v) console.warn('[SERVER ALERT] Distress alert triggered!'); });
    return socket;
}

/**
 * Runs the full 60-second session simulation.
 * @returns {Promise<{vrSocket, watchSocket}>} Open sockets for cleanup
 */
async function runSimulation() {
    console.log('='.repeat(60));
    console.log('[SIM] Starting continuous 60-second session simulation');
    console.log(`[SIM] VR Device ID:    ${VR_DEVICE_ID}`);
    console.log(`[SIM] Watch Device ID: ${WATCH_DEVICE_ID}`);
    console.log('='.repeat(60));

    // Step 1: Connect VR headset, then Watch 1 second later
    console.log('\n[STEP 1] Connecting VR headset...');
    const vrSocket = createSocket(VR_DEVICE_ID, 'VR');

    await delay(1000);
    console.log('[STEP 2] Connecting Watch...');
    const watchSocket = createSocket(WATCH_DEVICE_ID, 'Watch');

    // Allow both connections to complete their handshake and session creation
    await delay(1500);

    // Initialize live vitals at the BoardingState baseline
    let targetHr      = STAGES[0].targetHr;
    let targetStress  = STAGES[0].targetStress;
    let spo2Base      = STAGES[0].spo2Base;
    let currentHr     = targetHr;
    let currentStress = targetStress;

    // Schedule all stage transitions independently via setTimeout.
    // Each timeout updates the targets that the vitals loop drifts toward.
    for (const stage of STAGES) {
        setTimeout(() => {
            const label = `T=${stage.triggerMs / 1000}s`;
            console.log(`\n[VR → ${label}] Stage: ${stage.state}${stage.difficulty ? ` | Difficulty: ${stage.difficulty}` : ''}`);

            // Emit difficulty change first (server parses these as separate messages)
            if (stage.difficulty) {
                vrSocket.emit('vr_log_message', `The Level Diffculty is ${stage.difficulty}`);
            }
            vrSocket.emit('vr_log_message', `Flight state changed to: ${stage.state}`);

            // Update targets so the vitals loop drifts toward the new baseline
            targetHr     = stage.targetHr;
            targetStress = stage.targetStress;
            spo2Base     = stage.spo2Base;
        }, stage.triggerMs);
    }

    console.log('\n[SIM] Live telemetry loop started — 1 vitals update/second for 60 seconds\n');

    // Vitals loop: fires every 1 second for exactly 60 ticks
    await new Promise((resolve) => {
        let tick = 0;

        const interval = setInterval(() => {
            tick++;

            // Drift current vitals toward the active stage's target
            currentHr     = Math.max(50,  Math.min(200, drift(currentHr,     targetHr,     3)));
            currentStress = Math.max(0,   Math.min(100, drift(currentStress, targetStress, 3)));
            const spo2    = Math.max(88,  Math.min(100, Math.round(spo2Base + (Math.random() * 2 - 1))));

            const vitals = { heartRate: currentHr, stressScore: currentStress, spo2 };

            console.log(
                `[Watch t=${String(tick).padStart(2, '0')}s] ` +
                `HR: ${String(currentHr).padStart(3)} BPM | ` +
                `Stress: ${String(currentStress).padStart(3)} | ` +
                `SpO2: ${spo2}%`
            );
            watchSocket.emit('watch_vitals_update', vitals);

            if (tick >= SESSION_DURATION_MS / VITALS_INTERVAL_MS) {
                clearInterval(interval);
                resolve();
            }
        }, VITALS_INTERVAL_MS);
    });

    return { vrSocket, watchSocket };
}

async function main() {
    let vrSocket, watchSocket;
    try {
        ({ vrSocket, watchSocket } = await runSimulation());
    } finally {
        // Give the last DB write a moment to flush before disconnecting
        console.log('\n[SIM] 60-second session complete. Waiting 1s for last DB write...');
        await delay(1000);

        // Disconnect VR first — triggers completeSession() + HRV save on the server
        console.log('[SIM] Disconnecting VR socket (triggers session completion + HRV in DB)...');
        if (vrSocket) vrSocket.disconnect();

        await delay(500);
        console.log('[SIM] Disconnecting Watch socket...');
        if (watchSocket) watchSocket.disconnect();

        await delay(500);
        console.log('[SIM] All done. Check the DB and open View Record to see the chart.');
        process.exit(0);
    }
}

main();
