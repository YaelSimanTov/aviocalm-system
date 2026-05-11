// HRV Calculator Service
// Implements RMSSD (Root Mean Square of Successive Differences) algorithm for Heart Rate Variability

/**
 * Calculates HRV using RMSSD (Root Mean Square of Successive Differences) method
 * @param {Array<number>} heartRateData - Array of heart rate values in BPM
 * @returns {number|null} - Calculated HRV RMSSD score rounded to 2 decimal places, or null if insufficient data
 */
function calculateRMSSD(heartRateData) {
    // Validate input
    if (!Array.isArray(heartRateData) || heartRateData.length === 0) {
        console.warn('[HRV Calculator] Invalid or empty heart rate data provided');
        return null;
    }

    // Filter out invalid values (null, undefined, zero, negative, or non-numeric)
    const validHeartRates = heartRateData.filter(hr => 
        hr !== null && 
        hr !== undefined && 
        typeof hr === 'number' && 
        hr > 0 && 
        isFinite(hr)
    );

    // Need at least 2 valid readings for RMSSD calculation
    if (validHeartRates.length < 2) {
        console.warn('[HRV Calculator] Insufficient valid heart rate readings for RMSSD calculation');
        return null;
    }

    try {
        // Step 1: Convert heart rates to RR intervals in milliseconds
        // RR (ms) = 60000 / HR (BPM)
        const rrIntervals = validHeartRates.map(hr => 60000 / hr);

        // Step 2: Calculate differences between consecutive RR intervals
        const differences = [];
        for (let i = 1; i < rrIntervals.length; i++) {
            const difference = rrIntervals[i] - rrIntervals[i - 1];
            differences.push(difference);
        }

        // Step 3: Square each difference
        const squaredDifferences = differences.map(diff => diff * diff);

        // Step 4: Calculate the mean of squared differences
        const meanSquaredDifferences = squaredDifferences.reduce((sum, sqDiff) => sum + sqDiff, 0) / squaredDifferences.length;

        // Step 5: Calculate the square root of the mean (RMSSD)
        const rmssd = Math.sqrt(meanSquaredDifferences);

        // Step 6: Round to 2 decimal places and return
        const roundedRMSSD = Math.round(rmssd * 100) / 100;

        console.log(`[HRV Calculator] RMSSD calculated: ${roundedRMSSD}ms from ${validHeartRates.length} heart rate readings`);
        return roundedRMSSD;

    } catch (error) {
        console.error('[HRV Calculator] Error during RMSSD calculation:', error);
        return null;
    }
}

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
 * Calculates additional HRV metrics for comprehensive analysis
 * @param {Array<number>} heartRateData - Array of heart rate values in BPM
 * @returns {Object} - Object containing multiple HRV metrics
 */
function calculateHRVMetrics(heartRateData) {
    const validation = validateHeartRateData(heartRateData);
    
    if (!validation.isValid) {
        return {
            rmssd: null,
            meanHR: null,
            hrRange: null,
            dataQuality: validation
        };
    }

    const validHeartRates = heartRateData.filter(hr => 
        hr !== null && 
        hr !== undefined && 
        typeof hr === 'number' && 
        hr > 0 && 
        isFinite(hr)
    );

    const rmssd = calculateRMSSD(validHeartRates);
    const meanHR = validHeartRates.reduce((sum, hr) => sum + hr, 0) / validHeartRates.length;
    const hrRange = Math.max(...validHeartRates) - Math.min(...validHeartRates);

    return {
        rmssd: rmssd,
        meanHR: Math.round(meanHR * 100) / 100,
        hrRange: hrRange,
        dataQuality: validation
    };
}

module.exports = {
    calculateRMSSD,
    validateHeartRateData,
    calculateHRVMetrics
};
