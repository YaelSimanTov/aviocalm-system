/**
 * US 6.3 Socket Test Script — Dual Device Simulation
 * Simulates a real-world scenario where both devices from the same kit
 * connect as two separate sockets. Both should resolve to the same patient
 * and share the same session ID, proving the activeSessions Map works correctly.
 */

const { io } = require('socket.io-client');

// ============================================================
// PASTE YOUR DEVICE IDs HERE (both must belong to the same kit)
const VR_DEVICE_ID    = '123';
const WATCH_DEVICE_ID = '12345';
// ============================================================

const SERVER_URL = 'http://localhost:5000';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a socket connection and attaches standard event listeners
 * @param {string} deviceId - The device UUID to pass in the handshake query
 * @param {string} label - A display label for log messages (e.g. 'VR' or 'Watch')
 * @returns {Socket} The connected socket.io client instance
 */
function createSocket(deviceId, label) {
    const socket = io(SERVER_URL, {
        query: { deviceId },
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log(`[${label}] Connected with socket ID: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
        console.error(`[${label}] Connection error:`, err.message);
    });

    // Listen for server broadcast events
    socket.on('vr_status_change',    (v) => console.log(`[SERVER -> ${label}] vr_status_change: ${v}`));
    socket.on('watch_status_change', (v) => console.log(`[SERVER -> ${label}] watch_status_change: ${v}`));
    socket.on('distress_alert',      (v) => console.log(`[SERVER -> ${label}] distress_alert: ${v}`));

    return socket;
}

async function runTest() {
    console.log('='.repeat(60));
    console.log('[TEST] Starting dual-device simulation...');
    console.log(`[TEST] VR Device ID:    ${VR_DEVICE_ID}`);
    console.log(`[TEST] Watch Device ID: ${WATCH_DEVICE_ID}`);
    console.log('='.repeat(60));

    // Step 1: Connect VR headset first (patient puts on the headset)
    console.log('\n[STEP 1] Connecting VR headset...');
    const vrSocket = createSocket(VR_DEVICE_ID, 'VR');

    // Step 2: Wait 1 second, then connect the Watch (simulating watch pairing)
    await delay(1000);
    console.log('\n[STEP 2] Connecting Watch...');
    const watchSocket = createSocket(WATCH_DEVICE_ID, 'Watch');

    // Allow both sockets a moment to complete their connection handshake
    await delay(1000);

    // Step 3: VR emits a flight state change log
    const vrMessage = 'Flight state changed to: TakeOffState';
    console.log(`\n[STEP 3] VR emitting vr_log_message: "${vrMessage}"`);
    vrSocket.emit('vr_log_message', vrMessage);

    // Step 4: Watch emits a vitals update
    // This should be saved to anxiety_profiles using the shared session ID
    const vitals = { heartRate: 85, stressScore: 40, spo2: 98 };
    console.log('[STEP 4] Watch emitting watch_vitals_update:', vitals);
    watchSocket.emit('watch_vitals_update', vitals);

    // Step 5: Wait 2 seconds, then disconnect both sockets
    await delay(2000);
    console.log('\n[STEP 5] Disconnecting both sockets...');
    console.log('[TEST] VR disconnect should trigger session completion in the DB.');
    vrSocket.disconnect();
    watchSocket.disconnect();

    console.log('\n[TEST] Dual-device simulation complete.');
}

runTest();
