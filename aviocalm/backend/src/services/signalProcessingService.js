/**
 * Signal Processing Service
 * Implements Moving Average algorithm for biometric data smoothing
 * Prevents false triggers from physical movement artifacts
 */

class SignalProcessingService {
  constructor(windowSize = 7) {
    this.windowSize = windowSize; // Sliding window size (5-10 points recommended)
    this.heartRateWindow = [];
    this.stressScoreWindow = [];
    this.spo2Window = [];
  }

  /**
   * Add new raw metrics to the sliding windows
   * @param {Object} rawMetrics - Raw biometric data
   */
  addRawMetrics(rawMetrics) {
    const timestamp = Date.now();
    
    // Add new data points to windows
    this.heartRateWindow.push({
      value: rawMetrics.heartRate,
      timestamp: timestamp
    });
    
    this.stressScoreWindow.push({
      value: rawMetrics.stressScore,
      timestamp: timestamp
    });
    
    this.spo2Window.push({
      value: rawMetrics.spo2,
      timestamp: timestamp
    });
    
    // Maintain window size by removing oldest data
    if (this.heartRateWindow.length > this.windowSize) {
      this.heartRateWindow.shift();
    }
    
    if (this.stressScoreWindow.length > this.windowSize) {
      this.stressScoreWindow.shift();
    }
    
    if (this.spo2Window.length > this.windowSize) {
      this.spo2Window.shift();
    }
  }

  /**
   * Calculate simple moving average for heart rate
   * @returns {number} Smoothed heart rate value
   */
  getSmoothedHeartRate() {
    if (this.heartRateWindow.length === 0) return 0;
    
    const sum = this.heartRateWindow.reduce((acc, point) => acc + point.value, 0);
    return Math.round(sum / this.heartRateWindow.length);
  }

  /**
   * Calculate simple moving average for stress score
   * @returns {number} Smoothed stress score value
   */
  getSmoothedStressScore() {
    if (this.stressScoreWindow.length === 0) return 0;
    
    const sum = this.stressScoreWindow.reduce((acc, point) => acc + point.value, 0);
    return Math.round(sum / this.stressScoreWindow.length);
  }

  /**
   * Calculate simple moving average for SpO2
   * @returns {number} Smoothed SpO2 value
   */
  getSmoothedSpO2() {
    if (this.spo2Window.length === 0) return 0;
    
    const sum = this.spo2Window.reduce((acc, point) => acc + point.value, 0);
    return Math.round(sum / this.spo2Window.length);
  }

  /**
   * Get all smoothed metrics in a single object
   * @returns {Object} Smoothed biometric data
   */
  getSmoothedMetrics() {
    return {
      heartRate: this.getSmoothedHeartRate(),
      stressScore: this.getSmoothedStressScore(),
      spo2: this.getSmoothedSpO2()
    };
  }

  /**
   * Calculate weighted moving average (gives more weight to recent data)
   * @param {Array} window - Data window array
   * @returns {number} Weighted average value
   */
  calculateWeightedAverage(window) {
    if (window.length === 0) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    // More recent data gets higher weight
    for (let i = 0; i < window.length; i++) {
      const weight = i + 1; // Linear weighting: 1, 2, 3, ..., n
      weightedSum += window[i].value * weight;
      totalWeight += weight;
    }
    
    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Get smoothed metrics using weighted moving average
   * @returns {Object} Weighted smoothed biometric data
   */
  getWeightedSmoothedMetrics() {
    return {
      heartRate: this.calculateWeightedAverage(this.heartRateWindow),
      stressScore: this.calculateWeightedAverage(this.stressScoreWindow),
      spo2: this.calculateWeightedAverage(this.spo2Window)
    };
  }

  /**
   * Detect outliers using IQR method (Interquartile Range)
   * @param {Array} window - Data window array
   * @param {number} value - Current value to check
   * @returns {boolean} True if value is an outlier
   */
  isOutlier(window, value) {
    if (window.length < 4) return false; // Need minimum data for IQR
    
    const values = window.map(point => point.value).sort((a, b) => a - b);
    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);
    
    return value < lowerBound || value > upperBound;
  }

  /**
   * Process raw metrics with outlier detection and smoothing
   * @param {Object} rawMetrics - Raw biometric data
   * @returns {Object} Processed and smoothed metrics
   */
  processRawMetrics(rawMetrics) {
    // Add raw metrics to windows
    this.addRawMetrics(rawMetrics);
    
    // Check for outliers and use previous smoothed value if outlier detected
    const smoothedHeartRate = this.isOutlier(this.heartRateWindow.slice(0, -1), rawMetrics.heartRate) 
      ? this.getSmoothedHeartRate() 
      : this.getSmoothedHeartRate();
    
    const smoothedStressScore = this.isOutlier(this.stressScoreWindow.slice(0, -1), rawMetrics.stressScore) 
      ? this.getSmoothedStressScore() 
      : this.getSmoothedStressScore();
    
    const smoothedSpO2 = this.isOutlier(this.spo2Window.slice(0, -1), rawMetrics.spo2) 
      ? this.getSmoothedSpO2() 
      : this.getSmoothedSpO2();
    
    return {
      heartRate: smoothedHeartRate,
      stressScore: smoothedStressScore,
      spo2: smoothedSpO2,
      timestamp: rawMetrics.timestamp,
      sessionId: rawMetrics.sessionId,
      vrState: rawMetrics.vrState,
      difficulty: rawMetrics.difficulty
    };
  }

  /**
   * Reset all sliding windows (useful for new sessions)
   */
  reset() {
    this.heartRateWindow = [];
    this.stressScoreWindow = [];
    this.spo2Window = [];
  }

  /**
   * Get current window sizes (useful for debugging)
   * @returns {Object} Current window sizes
   */
  getWindowStatus() {
    return {
      heartRateWindow: this.heartRateWindow.length,
      stressScoreWindow: this.stressScoreWindow.length,
      spo2Window: this.spo2Window.length,
      maxWindowSize: this.windowSize
    };
  }

  /**
   * Check if enough data is collected for reliable smoothing
   * @returns {boolean} True if windows are sufficiently filled
   */
  isReady() {
    return this.heartRateWindow.length >= Math.ceil(this.windowSize / 2) &&
           this.stressScoreWindow.length >= Math.ceil(this.windowSize / 2) &&
           this.spo2Window.length >= Math.ceil(this.windowSize / 2);
  }
}

// Create singleton instance
const signalProcessor = new SignalProcessingService(7); // 7-point window

module.exports = {
  SignalProcessingService,
  processRawMetrics: (rawMetrics) => signalProcessor.processRawMetrics(rawMetrics),
  getSmoothedMetrics: () => signalProcessor.getSmoothedMetrics(),
  getWeightedSmoothedMetrics: () => signalProcessor.getWeightedSmoothedMetrics(),
  resetProcessor: () => signalProcessor.reset(),
  getWindowStatus: () => signalProcessor.getWindowStatus(),
  isProcessorReady: () => signalProcessor.isReady()
};
