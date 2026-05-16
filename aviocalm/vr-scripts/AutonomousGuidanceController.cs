using System;
using System.Text;
using UnityEngine;
using SocketIO;

namespace AvioCalm.VR
{
    /// <summary>
    /// Autonomous Guidance Controller
    /// Evaluates patient metrics and generates difficulty recommendations at the end of each flight phase
    /// Uses Socket.io for real-time communication with backend
    /// Part of Epic 4, User Story 4.3: Asynchronous Recommendation & Audit
    /// </summary>
    public class AutonomousGuidanceController : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private string socketServerUrl = "http://localhost:5000";
        [SerializeField] private float stressThresholdHrv = 30f; // HRV below this indicates high stress (ms)
        [SerializeField] private float stressThresholdHeartRate = 100f; // HR above this indicates high stress (bpm)
        
        // Socket.io client reference
        private SocketIOComponent socketIO;
        
        [Header("Session Data")]
        [SerializeField] private string currentSessionId;
        [SerializeField] private string currentPatientId;
        
        // Current metrics from the session
        private float currentHrv = 0f;
        private float currentHeartRate = 0f;
        
        // Recommendation state
        private int suggestedDifficulty = 0;
        private int actualDifficultySelectedByPatient = 0;
        private string systemRecommendationMessage = "";
        
        // UI references (abstract - can be connected later)
        [SerializeField] private UnityEngine.UI.Text recommendationText;
        [SerializeField] private UnityEngine.UI.Button agreeButton;
        [SerializeField] private UnityEngine.UI.Button disagreeButton;
        
        /// <summary>
        /// Initialize the controller with session data and Socket.io connection
        /// </summary>
        public void Initialize(string sessionId, string patientId)
        {
            currentSessionId = sessionId;
            currentPatientId = patientId;
            
            // Initialize Socket.io connection
            InitializeSocketIO();
            
            Debug.Log($"[AutonomousGuidance] Initialized for session: {sessionId}, patient: {patientId}");
        }
        
        /// <summary>
        /// Initialize Socket.io connection to backend
        /// </summary>
        private void InitializeSocketIO()
        {
            // Find or create SocketIOComponent
            socketIO = GetComponent<SocketIOComponent>();
            
            if (socketIO == null)
            {
                Debug.LogError("[AutonomousGuidance] SocketIOComponent not found on GameObject. Please add SocketIOComponent.");
                return;
            }
            
            // Configure socket URL
            socketIO.url = socketServerUrl;
            
            // Setup event handlers
            socketIO.On("connect", OnSocketConnected);
            socketIO.On("disconnect", OnSocketDisconnected);
            socketIO.On("error", OnSocketError);
            
            // Connect to server
            socketIO.Connect();
            
            Debug.Log($"[AutonomousGuidance] Socket.io connecting to: {socketServerUrl}");
        }
        
        /// <summary>
        /// Handle Socket.io connection event
        /// </summary>
        private void OnSocketConnected(SocketIOEvent obj)
        {
            Debug.Log("[AutonomousGuidance] Socket.io connected successfully");
            Console.WriteLine("[AutonomousGuidance] Socket.io connected");
        }
        
        /// <summary>
        /// Handle Socket.io disconnection event
        /// </summary>
        private void OnSocketDisconnected(SocketIOEvent obj)
        {
            Debug.LogWarning("[AutonomousGuidance] Socket.io disconnected");
            Console.WriteLine("[AutonomousGuidance] Socket.io disconnected");
        }
        
        /// <summary>
        /// Handle Socket.io error event
        /// </summary>
        private void OnSocketError(SocketIOEvent obj)
        {
            Debug.LogError($"[AutonomousGuidance] Socket.io error: {obj.data}");
            Console.WriteLine($"[AutonomousGuidance] Socket.io error: {obj.data}");
        }
        
        /// <summary>
        /// Update current metrics from the smartwatch/sensors
        /// </summary>
        public void UpdateMetrics(float hrv, float heartRate)
        {
            currentHrv = hrv;
            currentHeartRate = heartRate;
            Debug.Log($"[AutonomousGuidance] Metrics updated - HRV: {hrv}ms, HR: {heartRate}bpm");
        }
        
        /// <summary>
        /// Called at the end of each flight phase to evaluate and generate recommendation
        /// </summary>
        public void OnFlightPhaseEnd()
        {
            Debug.Log("[AutonomousGuidance] Flight phase ended - evaluating metrics...");
            
            // Evaluate metrics and generate recommendation
            EvaluatePatientMetrics();
            
            // Display recommendation (abstract UI)
            DisplayRecommendation();
            
            // Wait for patient choice (handled by UI buttons)
        }
        
        /// <summary>
        /// Evaluate patient metrics and determine stress level
        /// </summary>
        private void EvaluatePatientMetrics()
        {
            bool isHighStress = false;
            StringBuilder reasoning = new StringBuilder();
            
            // Check HRV (lower HRV = higher stress)
            if (currentHrv < stressThresholdHrv)
            {
                isHighStress = true;
                reasoning.AppendLine($"HRV ({currentHrv}ms) is below threshold ({stressThresholdHrv}ms)");
            }
            else
            {
                reasoning.AppendLine($"HRV ({currentHrv}ms) is within normal range");
            }
            
            // Check Heart Rate (higher HR = higher stress)
            if (currentHeartRate > stressThresholdHeartRate)
            {
                isHighStress = true;
                reasoning.AppendLine($"Heart Rate ({currentHeartRate}bpm) is above threshold ({stressThresholdHeartRate}bpm)");
            }
            else
            {
                reasoning.AppendLine($"Heart Rate ({currentHeartRate}bpm) is within normal range");
            }
            
            // Generate recommendation based on stress level
            if (isHighStress)
            {
                suggestedDifficulty = GetCurrentDifficulty() > 1 ? GetCurrentDifficulty() - 1 : 1;
                systemRecommendationMessage = $"HIGH STRESS DETECTED. {reasoning.ToString()}We recommend maintaining or reducing difficulty to Level {suggestedDifficulty}. Do not increase to Hard difficulty.";
                Debug.LogWarning($"[AutonomousGuidance] High stress detected - Recommendation: Level {suggestedDifficulty}");
            }
            else
            {
                suggestedDifficulty = GetCurrentDifficulty() < 5 ? GetCurrentDifficulty() + 1 : 5;
                systemRecommendationMessage = $"STRESS LEVEL NORMAL. {reasoning.ToString()}Patient is coping well. We recommend progressing to Level {suggestedDifficulty}.";
                Debug.Log($"[AutonomousGuidance] Normal stress - Recommendation: Level {suggestedDifficulty}");
            }
        }
        
        /// <summary>
        /// Get the current difficulty level (mock implementation - should be connected to actual game state)
        /// </summary>
        private int GetCurrentDifficulty()
        {
            // Mock implementation - in production, this should read from the actual game state
            // For now, return a default value of 3 (Medium)
            return 3;
        }
        
        /// <summary>
        /// Display the recommendation to the patient (abstract UI)
        /// </summary>
        private void DisplayRecommendation()
        {
            // Update UI text
            if (recommendationText != null)
            {
                recommendationText.text = systemRecommendationMessage;
            }
            
            // Log to console as fallback
            Debug.Log($"[AutonomousGuidance UI] Recommendation displayed: {systemRecommendationMessage}");
            Console.WriteLine($"[AutonomousGuidance UI] Recommendation: {systemRecommendationMessage}");
            
            // Enable choice buttons (abstract)
            if (agreeButton != null) agreeButton.interactable = true;
            if (disagreeButton != null) disagreeButton.interactable = true;
        }
        
        /// <summary>
        /// Called when patient agrees with the recommendation
        /// </summary>
        public void OnPatientAgree()
        {
            actualDifficultySelectedByPatient = suggestedDifficulty;
            Debug.Log($"[AutonomousGuidance] Patient agreed - Selected difficulty: {actualDifficultySelectedByPatient}");
            
            // Send decision to backend
            SendTreatmentDecisionToBackend();
            
            // Disable buttons
            if (agreeButton != null) agreeButton.interactable = false;
            if (disagreeButton != null) disagreeButton.interactable = false;
        }
        
        /// <summary>
        /// Called when patient disagrees with the recommendation
        /// </summary>
        public void OnPatientDisagree()
        {
            // Patient chooses to maintain current difficulty instead of recommendation
            actualDifficultySelectedByPatient = GetCurrentDifficulty();
            Debug.Log($"[AutonomousGuidance] Patient disagreed - Maintaining current difficulty: {actualDifficultySelectedByPatient}");
            
            // Send decision to backend
            SendTreatmentDecisionToBackend();
            
            // Disable buttons
            if (agreeButton != null) agreeButton.interactable = false;
            if (disagreeButton != null) disagreeButton.interactable = false;
        }
        
        /// <summary>
        /// Send treatment decision to backend via Socket.io
        /// </summary>
        private void SendTreatmentDecisionToBackend()
        {
            if (socketIO == null || !socketIO.connected)
            {
                Debug.LogError("[AutonomousGuidance] Socket.io not connected. Cannot send treatment decision.");
                Console.WriteLine("[AutonomousGuidance] Error: Socket.io not connected");
                return;
            }
            
            // Construct the payload
            JSONObject payload = new JSONObject();
            payload.AddField("session_id", currentSessionId);
            payload.AddField("patient_id", currentPatientId);
            payload.AddField("suggested_difficulty", suggestedDifficulty);
            payload.AddField("actual_difficulty_selected_by_patient", actualDifficultySelectedByPatient);
            payload.AddField("system_timestamp", DateTime.UtcNow.ToString("o")); // ISO 8601 format
            
            // Emit event to backend
            socketIO.Emit("treatment_decision", payload);
            
            Debug.Log($"[AutonomousGuidance] Treatment decision emitted via Socket.io");
            Debug.Log($"[AutonomousGuidance] Payload: session_id={currentSessionId}, patient_id={currentPatientId}, suggested_difficulty={suggestedDifficulty}, actual_difficulty={actualDifficultySelectedByPatient}");
            Console.WriteLine($"[AutonomousGuidance] Treatment decision sent successfully via Socket.io");
        }
        
        /// <summary>
        /// Cleanup on destroy
        /// </summary>
        private void OnDestroy()
        {
            if (socketIO != null)
            {
                socketIO.Off("connect", OnSocketConnected);
                socketIO.Off("disconnect", OnSocketDisconnected);
                socketIO.Off("error", OnSocketError);
                
                if (socketIO.connected)
                {
                    socketIO.Disconnect();
                }
            }
        }
    }
}
