// HRV Calculator Service
// Implements RMSSD (Root Mean Square of Successive Differences) algorithm for Heart Rate Variability

 
/**
 * Validates heart rate data quality before processing
 * @param {Array<number>} heartRateData - Array of heart rate values to validate
 * @returns {Object} - Validation result with isValid flag and details
 */
function validateHeartRateData(heartRateData) {
    if (!Array.isArray(heartRateData)) {
        return { isValid: false, reason: 'Input is not an array' };
    }

    if (heartRateData.length === 0) {
        return { isValid: false, reason: 'Empty array provided' };
    }

    const validCount = heartRateData.filter(hr => 
        hr !== null && 
        hr !== undefined && 
        typeof hr === 'number' && 
        hr > 0 && 
        isFinite(hr)
    ).length;

    const invalidCount = heartRateData.length - validCount;

    return {
        isValid: validCount >= 2,
        totalReadings: heartRateData.length,
        validReadings: validCount,
        invalidReadings: invalidCount,
        reason: validCount < 2 ? 'Insufficient valid readings (minimum 2 required)' : null
    };
}

 
/**
 * Calculates a Stress Score (0-100) from an array of IBI (Inter-Beat Interval) values.
 * Uses the RMSSD method: lower HRV (lower RMSSD) maps to higher stress.
 * Designed for standalone use without clinical baselines.
 *
 * @param {Array<number>} ibiArray - IBI values in milliseconds (same as RR intervals)
 * @returns {number} - Stress score 0 (relaxed) to 100 (high stress); returns 50 if data is insufficient
 */
function calculateStressFromIBI(ibiArray) {
    if (!Array.isArray(ibiArray) || ibiArray.length < 2) {
        return 50; // Return neutral score when data is insufficient
    }

    // Step 1: Filter out physiologically implausible IBI values
    // Valid range: 300ms–1500ms (equivalent to 40–200 BPM)
    const valid = ibiArray.filter(v => typeof v === 'number' && v >= 300 && v <= 1500);
    if (valid.length < 2) {
        return 50;
    }

    // Step 2: Calculate RMSSD directly from successive IBI differences
    // IBI values are already in ms (equivalent to RR intervals), so no BPM conversion needed
    let sumSquaredDiffs = 0;
    for (let i = 1; i < valid.length; i++) {
        const diff = valid[i] - valid[i - 1];
        sumSquaredDiffs += diff * diff;
    }
    const rmssd = Math.sqrt(sumSquaredDiffs / (valid.length - 1));

    // Step 3: Invert and normalize RMSSD into a 0-100 stress score
    // Reference range without clinical baselines:
    //   RMSSD_MIN = 15ms  → stress score 100 (high stress / very low HRV)
    //   RMSSD_MAX = 100ms → stress score 0   (relaxed / high HRV)
    const RMSSD_MIN = 15;
    const RMSSD_MAX = 100;
    const normalized = (rmssd - RMSSD_MIN) / (RMSSD_MAX - RMSSD_MIN);
    const stressScore = Math.round(Math.max(0, Math.min(100, (1 - normalized) * 100)));

    return stressScore;
}

module.exports = {
    validateHeartRateData,
    calculateStressFromIBI
};
