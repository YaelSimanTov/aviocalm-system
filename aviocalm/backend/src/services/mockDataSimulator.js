/**
 * Mock Data Simulator Service
 * Generates realistic biometric data for testing without real hardware
 * Centralizes all mock data logic for easy cleanup when real hardware arrives
 */

const { processSceneCompletion } = require('./clinicalScoringService');

class MockDataSimulator {
  constructor(io) {
    this.isRunning = false;
    this.simulationInterval = null;
    this.io = io;
    
    // Scene tracking for clinical scoring
    this.currentSceneMetrics = [];
    this.currentVrState = 'Boarding';
    this.currentDifficulty = 'Easy';
    this.sessionId = `session_${Date.now()}`;
    this.patientId = '550e8400-e29b-41d4-a716-446655440000'; // Mock patient ID
    
    // Baseline values for realistic simulation
    this.baseline = {
      heartRate: 75,
      stressScore: 20,
      spo2: 98
    };
    
    // Current values that will change over time
    this.current = {
      heartRate: this.baseline.heartRate,
      stressScore: this.baseline.stressScore,
      spo2: this.baseline.spo2,
      vrState: 'Boarding',
      difficulty: 'Easy'
    };
    
    // VR states for realistic progression
    this.vrStates = ['Boarding', 'Takeoff', 'Cruising', 'Landing', 'Taxiing'];
    this.difficulties = ['Easy', 'Medium', 'Hard'];
    this.currentStateIndex = 0;
    this.currentDifficultyIndex = 0;
    
    // Simulation phases
    this.phase = 'calm'; // calm, rising, peak, recovery
    this.phaseTimer = 0;
  }

  /**
   * Start the mock data simulation
   * Emits realistic biometric data every second
   */
  start() {
    if (this.isRunning) {
      console.log('[MOCK SIMULATOR] Already running');
      return;
    }

    console.log('[MOCK SIMULATOR] Starting mock data generation...');
    this.isRunning = true;
    
    // Emit initial connection status
    this.io.emit('vr_status_change', true);
    this.io.emit('watch_status_change', true);
    
    this.simulationInterval = setInterval(() => {
      this.generateMockData();
    }, 1000); // Generate data every second
  }

  /**
   * Stop the mock data simulation
   */
  stop() {
    if (!this.isRunning) {
      console.log('[MOCK SIMULATOR] Already stopped');
      return;
    }

    console.log('[MOCK SIMULATOR] Stopping mock data generation...');
    this.isRunning = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    // Emit disconnection status
    this.io.emit('vr_status_change', false);
    this.io.emit('watch_status_change', false);
  }

  /**
   * Generate realistic mock biometric data
   * Simulates different phases of a VR flight session
   */
  generateMockData() {
    this.phaseTimer++;
    
    // Change VR state periodically for realism
    if (this.phaseTimer % 30 === 0) { // Every 30 seconds
      const previousVrState = this.current.vrState;
      const previousDifficulty = this.current.difficulty;
      
      // Update VR state
      this.currentStateIndex = (this.currentStateIndex + 1) % this.vrStates.length;
      this.current.vrState = this.vrStates[this.currentStateIndex];
      
      // Occasionally increase difficulty
      if (Math.random() < 0.3) {
        this.currentDifficultyIndex = Math.min(this.currentDifficultyIndex + 1, this.difficulties.length - 1);
        this.current.difficulty = this.difficulties[this.currentDifficultyIndex];
      }
      
      // Trigger clinical scoring for completed scene
      if (this.currentSceneMetrics.length > 0 && previousVrState !== this.current.vrState) {
        this.processCompletedScene(previousVrState, previousDifficulty);
      }
    }
    
    // Simulate different stress phases
    this.simulateStressPhase();
    
    // Generate realistic vitals with some noise
    const heartRateNoise = (Math.random() - 0.5) * 4; // ±2 BPM noise
    const stressNoise = (Math.random() - 0.5) * 3; // ±1.5 stress points noise
    const spo2Noise = (Math.random() - 0.5) * 1; // ±0.5% SpO2 noise
    
    const mockData = {
      sessionId: `session_${Date.now()}`,
      timestamp: new Date().toISOString(),
      vitals: {
        heartRate: Math.round(this.current.heartRate + heartRateNoise),
        stressScore: Math.round(Math.max(0, this.current.stressScore + stressNoise)),
        spo2: Math.round(Math.max(90, Math.min(100, this.current.spo2 + spo2Noise)))
      },
      vrState: this.current.vrState,
      difficulty: this.current.difficulty,
      isWarning: this.current.heartRate > 100,
      isEmergency: this.current.heartRate > 120 || this.current.stressScore > 80
    };
    
    // Emit live metrics to all connected clients
    this.io.emit('live_metrics', mockData);
    
    // Emit emergency stop if thresholds are crossed
    if (mockData.isEmergency) {
      this.io.emit('EMERGENCY_STOP', {
        reason: this.current.heartRate > 120 ? 'High Heart Rate' : 'High Stress Score',
        timestamp: mockData.timestamp,
        vitals: mockData.vitals
      });
    }
    
    console.log(`[MOCK SIMULATOR] Generated: HR=${mockData.vitals.heartRate} | Stress=${mockData.vitals.stressScore} | SpO2=${mockData.vitals.spo2}% | State=${mockData.vrState}`);
    
    // Add current metrics to scene tracking
    this.currentSceneMetrics.push({
      timestamp: mockData.timestamp,
      heartRate: mockData.vitals.heartRate,
      stressScore: mockData.vitals.stressScore,
      spo2: mockData.vitals.spo2
    });
  }

  /**
   * Process completed scene and trigger clinical scoring
   * @param {string} completedVrState - VR state that just completed
   * @param {string} completedDifficulty - Difficulty level of completed scene
   */
  async processCompletedScene(completedVrState, completedDifficulty) {
    try {
      console.log(`[MOCK SIMULATOR] Processing completed scene: ${completedVrState} with ${this.currentSceneMetrics.length} data points`);
      
      // Trigger clinical scoring service
      await processSceneCompletion(
        this.currentSceneMetrics,
        this.sessionId,
        this.patientId,
        completedVrState,
        completedDifficulty
      );
      
      // Clear current scene metrics for next scene
      this.currentSceneMetrics = [];
      
      console.log(`[MOCK SIMULATOR] Successfully processed scene: ${completedVrState}`);
    } catch (error) {
      console.error(`[MOCK SIMULATOR] Error processing completed scene:`, error);
    }
  }

  /**
   * Simulate realistic stress phases during VR session
   * Includes severe panic attack for testing safety brakes
   */
  simulateStressPhase() {
    const phaseDuration = 60; // 60 seconds per phase
    
    if (this.phaseTimer < phaseDuration) {
      // Calm phase - stable baseline values
      this.phase = 'calm';
      this.current.heartRate = this.baseline.heartRate + (Math.random() - 0.5) * 5;
      this.current.stressScore = this.baseline.stressScore + (Math.random() - 0.5) * 5;
    } else if (this.phaseTimer < phaseDuration * 2) {
      // Rising phase - gradual increase in stress
      this.phase = 'rising';
      const progress = (this.phaseTimer - phaseDuration) / phaseDuration;
      this.current.heartRate = this.baseline.heartRate + (progress * 25);
      this.current.stressScore = this.baseline.stressScore + (progress * 30);
    } else if (this.phaseTimer < phaseDuration * 2.5) {
      // Peak phase - moderate stress
      this.phase = 'peak';
      this.current.heartRate = this.baseline.heartRate + 25 + (Math.random() - 0.5) * 10;
      this.current.stressScore = this.baseline.stressScore + 30 + (Math.random() - 0.5) * 10;
    } else if (this.phaseTimer < phaseDuration * 2.75) {
      // PANIC ATTACK PHASE - severe physiological response
      this.phase = 'panic';
      const panicProgress = (this.phaseTimer - phaseDuration * 2.5) / (phaseDuration * 0.25); // 15 seconds
      
      // Rapid HR spike from 100 to 140-165 BPM
      const targetHR = 140 + Math.random() * 25; // 140-165 BPM range
      this.current.heartRate = 100 + (panicProgress * (targetHR - 100));
      
      // Aggressive stress score escalation to 95-100
      const targetStress = 95 + Math.random() * 5; // 95-100 range
      this.current.stressScore = 50 + (panicProgress * (targetStress - 50));
      
      // SpO2 drop to 93-95% (hyperventilation simulation)
      const targetSpO2 = 93 + Math.random() * 2; // 93-95% range
      this.current.spo2 = this.baseline.spo2 - (panicProgress * (this.baseline.spo2 - targetSpO2));
      
      console.log(`[PANIC ATTACK] HR: ${Math.round(this.current.heartRate)} | Stress: ${Math.round(this.current.stressScore)} | SpO2: ${Math.round(this.current.spo2)}%`);
    } else if (this.phaseTimer < phaseDuration * 3.25) {
      // Sustained peak values for safety brake testing
      this.phase = 'sustained_peak';
      
      // Maintain extreme values for 30 seconds
      this.current.heartRate = 140 + Math.random() * 25; // 140-165 BPM
      this.current.stressScore = 95 + Math.random() * 5; // 95-100
      this.current.spo2 = 93 + Math.random() * 2; // 93-95%
      
      console.log(`[SUSTAINED PEAK] HR: ${Math.round(this.current.heartRate)} | Stress: ${Math.round(this.current.stressScore)} | SpO2: ${Math.round(this.current.spo2)}%`);
    } else if (this.phaseTimer < phaseDuration * 4) {
      // Recovery phase - gradual return to baseline
      this.phase = 'recovery';
      const progress = (this.phaseTimer - phaseDuration * 3.25) / (phaseDuration * 0.75);
      this.current.heartRate = (140 + Math.random() * 25) - (progress * (65 + Math.random() * 25));
      this.current.stressScore = (95 + Math.random() * 5) - (progress * (75 + Math.random() * 5));
      this.current.spo2 = (93 + Math.random() * 2) + (progress * (5 + Math.random() * 2));
    } else {
      // Reset cycle
      this.phaseTimer = 0;
    }
  }

  /**
   * Get current simulation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      phase: this.phase,
      currentVrState: this.current.vrState,
      currentDifficulty: this.current.difficulty,
      currentHeartRate: Math.round(this.current.heartRate),
      currentStressScore: Math.round(this.current.stressScore)
    };
  }
}

// Create singleton instance
let mockSimulator = null;

module.exports = {
  initializeMockSimulator: (io) => {
    if (!mockSimulator) {
      mockSimulator = new MockDataSimulator(io);
    }
    return mockSimulator;
  },
  startMockSimulation: () => {
    if (!mockSimulator) {
      throw new Error('Mock simulator not initialized. Call initializeMockSimulator(io) first.');
    }
    mockSimulator.start();
  },
  stopMockSimulation: () => {
    if (!mockSimulator) {
      throw new Error('Mock simulator not initialized. Call initializeMockSimulator(io) first.');
    }
    mockSimulator.stop();
  },
  getMockSimulationStatus: () => {
    if (!mockSimulator) {
      throw new Error('Mock simulator not initialized. Call initializeMockSimulator(io) first.');
    }
    return mockSimulator.getStatus();
  }
};
