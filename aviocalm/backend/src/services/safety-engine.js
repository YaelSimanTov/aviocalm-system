/**
 * Safety Engine Core
 * Implements multi-channel safety monitoring for VR therapy sessions
 * Currently implements Absolute Safety Channel with medical norms validation
 */

class SafetyEngine {
  constructor(io) {
    this.io = io; // Socket.io instance for emergency event emission
    
    this.thresholds = {
      // Default thresholds - will be overridden by medical norms
      maxHeartRate: 120,
      minSpO2: 90,
      maxStress: 80,
      durationThreshold: 30, // seconds
      deltaHeartRatePercent: 25.0
    };
    
    // Channel states tracking
    this.channelStates = {
      absoluteSafety: {
        isActive: false,
        startTime: null,
        duration: 0,
        triggeredBy: null
      },
      relativeSafety: {
        isActive: false,
        startTime: null,
        duration: 0,
        triggeredBy: null
      },
      combinedPanic: {
        isActive: false,
        startTime: null,
        duration: 0,
        triggeredBy: null
      }
    };
    
    // Patient baseline data
    this.patientBaseline = {
      restingHeartRate: 75,
      restingStress: 20
    };
    
    // Medical norms based on age and health status
    this.medicalNorms = null;
    
    // HR trend tracking for Combined Panic Channel
    this.hrTrendWindow = []; // Store last 5 HR values for trend analysis
  }

  /**
   * Load medical norms for safety thresholds
   * @param {Object} norms - Medical norms from database
   */
  setMedicalNorms(norms) {
    this.medicalNorms = norms;
    this.thresholds.maxHeartRate = norms.max_heart_rate;
    this.thresholds.minSpO2 = norms.spo2_min;
    this.thresholds.maxStress = norms.stress_max;
    this.thresholds.durationThreshold = norms.duration_threshold;
    this.thresholds.deltaHeartRatePercent = norms.delta_hr_percent;
    
    console.log(`[SAFETY ENGINE] Medical norms loaded: HR Max=${this.thresholds.maxHeartRate}, SpO2 Min=${this.thresholds.minSpO2}, Stress Max=${this.thresholds.maxStress}`);
  }

  /**
   * Set patient baseline for relative safety calculations
   * @param {Object} baseline - Patient baseline data
   */
  setPatientBaseline(baseline) {
    this.patientBaseline = {
      restingHeartRate: baseline.avg_resting_hr,
      restingStress: baseline.avg_resting_stress
    };
    
    console.log(`[SAFETY ENGINE] Patient baseline set: HR=${this.patientBaseline.restingHeartRate}, Stress=${this.patientBaseline.restingStress}`);
  }

  /**
   * Evaluate Absolute Safety Channel
   * Checks HR > Max OR SpO2 < Min for specified duration
   * @param {Object} metrics - Smoothed biometric metrics
   * @returns {Object} Channel evaluation result
   */
  evaluateAbsoluteSafetyChannel(metrics) {
    const currentTime = Date.now();
    const channel = this.channelStates.absoluteSafety;
    
    // Check absolute threshold violations
    const hrViolation = metrics.heartRate > this.thresholds.maxHeartRate;
    const spo2Violation = metrics.spo2 < this.thresholds.minSpO2;
    const stressViolation = metrics.stressScore > this.thresholds.maxStress;
    
    const hasViolation = hrViolation || spo2Violation || stressViolation;
    
    if (hasViolation) {
      // Start or continue violation tracking
      if (!channel.isActive) {
        channel.isActive = true;
        channel.startTime = currentTime;
        channel.triggeredBy = [];
        
        if (hrViolation) channel.triggeredBy.push(`HR > ${this.thresholds.maxHeartRate}`);
        if (spo2Violation) channel.triggeredBy.push(`SpO2 < ${this.thresholds.minSpO2}`);
        if (stressViolation) channel.triggeredBy.push(`Stress > ${this.thresholds.maxStress}`);
        
        console.log(`[SAFETY ENGINE] Absolute Safety Channel VIOLATION START: ${channel.triggeredBy.join(', ')}`);
      }
      
      // Calculate duration of violation
      channel.duration = Math.floor((currentTime - channel.startTime) / 1000);
      
      // Check if duration threshold exceeded
      const isEmergency = channel.duration >= this.thresholds.durationThreshold;
      
      if (isEmergency) {
        console.log(`[SAFETY ENGINE] ABSOLUTE SAFETY EMERGENCY: Violation duration ${channel.duration}s exceeds threshold ${this.thresholds.durationThreshold}s`);
      }
      
      return {
        channel: 'absoluteSafety',
        isActive: true,
        isEmergency: isEmergency,
        duration: channel.duration,
        triggeredBy: channel.triggeredBy,
        metrics: {
          heartRate: metrics.heartRate,
          spo2: metrics.spo2,
          stressScore: metrics.stressScore,
          thresholds: {
            maxHeartRate: this.thresholds.maxHeartRate,
            minSpO2: this.thresholds.minSpO2,
            maxStress: this.thresholds.maxStress
          }
        }
      };
    } else {
      // No violation - reset channel if it was active
      if (channel.isActive) {
        console.log(`[SAFETY ENGINE] Absolute Safety Channel CLEARED: Violation lasted ${channel.duration}s`);
        this.resetChannel('absoluteSafety');
      }
      
      return {
        channel: 'absoluteSafety',
        isActive: false,
        isEmergency: false,
        duration: 0,
        triggeredBy: null
      };
    }
  }

  /**
   * Evaluate Relative Safety Channel
   * Checks HR crosses Baseline by Delta_HR_Percent for Duration
   * @param {Object} metrics - Smoothed biometric metrics
   * @returns {Object} Channel evaluation result
   */
  evaluateRelativeSafetyChannel(metrics) {
    const currentTime = Date.now();
    const channel = this.channelStates.relativeSafety;
    
    // Calculate threshold based on patient baseline
    const hrThreshold = this.patientBaseline.restingHeartRate * (1 + this.thresholds.deltaHeartRatePercent / 100);
    
    // Check if heart rate exceeds baseline threshold
    const hrViolation = metrics.heartRate > hrThreshold;
    
    if (hrViolation) {
      // Start or continue violation tracking
      if (!channel.isActive) {
        channel.isActive = true;
        channel.startTime = currentTime;
        channel.triggeredBy = [`HR > Baseline (${Math.round(hrThreshold)} BPM)`];
        
        console.log(`[SAFETY ENGINE] Relative Safety Channel VIOLATION START: HR=${metrics.heartRate} > Baseline=${Math.round(hrThreshold)}`);
      }
      
      // Calculate duration of violation
      channel.duration = Math.floor((currentTime - channel.startTime) / 1000);
      
      // Check if duration threshold exceeded
      const isEmergency = channel.duration >= this.thresholds.durationThreshold;
      
      if (isEmergency) {
        console.log(`[SAFETY ENGINE] RELATIVE SAFETY EMERGENCY: HR violation duration ${channel.duration}s exceeds threshold ${this.thresholds.durationThreshold}s`);
      }
      
      return {
        channel: 'relativeSafety',
        isActive: true,
        isEmergency: isEmergency,
        duration: channel.duration,
        triggeredBy: channel.triggeredBy,
        metrics: {
          heartRate: metrics.heartRate,
          baselineHR: this.patientBaseline.restingHeartRate,
          hrThreshold: hrThreshold,
          deltaPercent: this.thresholds.deltaHeartRatePercent
        }
      };
    } else {
      // No violation - reset channel if it was active
      if (channel.isActive) {
        console.log(`[SAFETY ENGINE] Relative Safety Channel CLEARED: Violation lasted ${channel.duration}s`);
        this.resetChannel('relativeSafety');
      }
      
      return {
        channel: 'relativeSafety',
        isActive: false,
        isEmergency: false,
        duration: 0,
        triggeredBy: null
      };
    }
  }

  /**
   * Evaluate Combined Panic Channel
   * Checks Stress > Max + consistent upward HR trend
   * @param {Object} metrics - Smoothed biometric metrics
   * @returns {Object} Channel evaluation result
   */
  evaluateCombinedPanicChannel(metrics) {
    const currentTime = Date.now();
    const channel = this.channelStates.combinedPanic;
    
    // Update HR trend window
    this.hrTrendWindow.push({
      value: metrics.heartRate,
      timestamp: currentTime
    });
    
    // Keep only last 5 data points
    if (this.hrTrendWindow.length > 5) {
      this.hrTrendWindow.shift();
    }
    
    // Check conditions for combined panic
    const stressViolation = metrics.stressScore > this.thresholds.maxStress;
    const upwardHRTrend = this.detectUpwardHRTrend();
    
    if (stressViolation && upwardHRTrend) {
      // Start or continue violation tracking
      if (!channel.isActive) {
        channel.isActive = true;
        channel.startTime = currentTime;
        channel.triggeredBy = [
          `Stress > ${this.thresholds.maxStress}`,
          'Consistent upward HR trend'
        ];
        
        console.log(`[SAFETY ENGINE] Combined Panic Channel VIOLATION START: Stress=${metrics.stressScore} > ${this.thresholds.maxStress} + HR trend detected`);
      }
      
      // Calculate duration of violation
      channel.duration = Math.floor((currentTime - channel.startTime) / 1000);
      
      // Check if duration threshold exceeded
      const isEmergency = channel.duration >= this.thresholds.durationThreshold;
      
      if (isEmergency) {
        console.log(`[SAFETY ENGINE] COMBINED PANIC EMERGENCY: Combined violation duration ${channel.duration}s exceeds threshold ${this.thresholds.durationThreshold}s`);
      }
      
      return {
        channel: 'combinedPanic',
        isActive: true,
        isEmergency: isEmergency,
        duration: channel.duration,
        triggeredBy: channel.triggeredBy,
        metrics: {
          stressScore: metrics.stressScore,
          stressThreshold: this.thresholds.maxStress,
          heartRate: metrics.heartRate,
          hrTrend: 'upward',
          hrTrendWindow: [...this.hrTrendWindow]
        }
      };
    } else {
      // No violation - reset channel if it was active
      if (channel.isActive) {
        console.log(`[SAFETY ENGINE] Combined Panic Channel CLEARED: Violation lasted ${channel.duration}s`);
        this.resetChannel('combinedPanic');
      }
      
      return {
        channel: 'combinedPanic',
        isActive: false,
        isEmergency: false,
        duration: 0,
        triggeredBy: null
      };
    }
  }

  /**
   * Detect consistent upward HR trend in the last 5 data points
   * @returns {boolean} True if consistent upward trend detected
   */
  detectUpwardHRTrend() {
    if (this.hrTrendWindow.length < 5) return false;
    
    // Check if at least 4 out of 5 consecutive points show an upward trend
    let upwardCount = 0;
    
    for (let i = 1; i < this.hrTrendWindow.length; i++) {
      if (this.hrTrendWindow[i].value > this.hrTrendWindow[i - 1].value) {
        upwardCount++;
      }
    }
    
    // Require at least 80% upward movement (4 out of 5)
    return upwardCount >= 4;
  }

  /**
   * Run complete safety evaluation on all channels
   * @param {Object} metrics - Smoothed biometric metrics
   * @returns {Object} Complete safety evaluation result
   */
  evaluateSafety(metrics) {
    // Evaluate all channels
    const absoluteResult = this.evaluateAbsoluteSafetyChannel(metrics);
    const relativeResult = this.evaluateRelativeSafetyChannel(metrics);
    const panicResult = this.evaluateCombinedPanicChannel(metrics);
    
    // Determine overall safety status
    const activeChannels = [];
    const emergencyChannels = [];
    
    if (absoluteResult.isActive) activeChannels.push('absoluteSafety');
    if (relativeResult.isActive) activeChannels.push('relativeSafety');
    if (panicResult.isActive) activeChannels.push('combinedPanic');
    
    if (absoluteResult.isEmergency) emergencyChannels.push('absoluteSafety');
    if (relativeResult.isEmergency) emergencyChannels.push('relativeSafety');
    if (panicResult.isEmergency) emergencyChannels.push('combinedPanic');
    
    const overallEmergency = emergencyChannels.length > 0;
    const overallWarning = activeChannels.length > 0 && !overallEmergency;
    
    // Emit TERMINATE event if any channel triggers emergency
    if (overallEmergency) {
      const emergencyChannel = emergencyChannels[0]; // Get first triggered channel
      const channelResult = emergencyChannel === 'absoluteSafety' ? absoluteResult :
                          emergencyChannel === 'relativeSafety' ? relativeResult : panicResult;
      
      const terminatePayload = {
        reason: `${emergencyChannel} Channel Triggered: ${channelResult.triggeredBy.join(', ')}`,
        channel: emergencyChannel,
        timestamp: new Date().toISOString(),
        vitals: {
          heartRate: metrics.heartRate,
          stressScore: metrics.stressScore,
          spo2: metrics.spo2
        },
        triggeredBy: channelResult.triggeredBy,
        duration: channelResult.duration,
        thresholds: this.thresholds
      };
      
      // Emit TERMINATE event to all connected clients
      this.io.emit('TERMINATE', terminatePayload);
      
      console.log(`[SAFETY ENGINE] TERMINATE EVENT EMITTED: ${terminatePayload.reason}`);
    }
    
    return {
      timestamp: new Date().toISOString(),
      overallStatus: overallEmergency ? 'EMERGENCY' : overallWarning ? 'WARNING' : 'NORMAL',
      isEmergency: overallEmergency,
      isWarning: overallWarning,
      activeChannels: activeChannels,
      emergencyChannels: emergencyChannels,
      channelResults: {
        absoluteSafety: absoluteResult,
        relativeSafety: relativeResult,
        combinedPanic: panicResult
      },
      metrics: metrics,
      thresholds: this.thresholds
    };
  }

  /**
   * Reset a specific channel
   * @param {string} channelName - Name of channel to reset
   */
  resetChannel(channelName) {
    if (this.channelStates[channelName]) {
      this.channelStates[channelName] = {
        isActive: false,
        startTime: null,
        duration: 0,
        triggeredBy: null
      };
    }
  }

  /**
   * Reset all channels (useful for new sessions)
   */
  resetAllChannels() {
    this.resetChannel('absoluteSafety');
    this.resetChannel('relativeSafety');
    this.resetChannel('combinedPanic');
    console.log('[SAFETY ENGINE] All channels reset');
  }

  /**
   * Get current status of all channels
   * @returns {Object} Channel status information
   */
  getChannelStatus() {
    return {
      thresholds: this.thresholds,
      patientBaseline: this.patientBaseline,
      channelStates: { ...this.channelStates },
      medicalNorms: this.medicalNorms
    };
  }

  /**
   * Validate medical norms data structure
   * @param {Object} norms - Medical norms to validate
   * @returns {boolean} True if valid
   */
  validateMedicalNorms(norms) {
    const requiredFields = [
      'max_heart_rate', 'spo2_min', 'stress_max', 
      'duration_threshold', 'delta_hr_percent'
    ];
    
    for (const field of requiredFields) {
      if (norms[field] === undefined || norms[field] === null) {
        console.error(`[SAFETY ENGINE] Missing required medical norm field: ${field}`);
        return false;
      }
    }
    
    return true;
  }
}

// Create singleton instance (will be initialized with io instance)
let safetyEngine = null;

// Initialize function to create safety engine with io instance
const initializeSafetyEngine = (io) => {
  if (!safetyEngine) {
    safetyEngine = new SafetyEngine(io);
  }
  return safetyEngine;
};

module.exports = {
  SafetyEngine,
  initializeSafetyEngine,
  evaluateSafety: (metrics) => safetyEngine.evaluateSafety(metrics),
  setMedicalNorms: (norms) => safetyEngine.setMedicalNorms(norms),
  setPatientBaseline: (baseline) => safetyEngine.setPatientBaseline(baseline),
  resetAllChannels: () => safetyEngine.resetAllChannels(),
  getChannelStatus: () => safetyEngine.getChannelStatus()
};
