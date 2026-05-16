/**
 * TreatmentDecision Entity/DTO
 * Represents a system-recommended difficulty and patient's actual selection
 * Part of Epic 4, User Story 4.3: Asynchronous Recommendation & Audit
 */

/**
 * @typedef {Object} TreatmentDecision
 * @property {string} decision_id - Unique identifier for the decision
 * @property {string} session_id - Reference to the session
 * @property {string} patient_id - Reference to the patient
 * @property {number} suggested_difficulty - System-recommended difficulty level (1-5)
 * @property {number} actual_difficulty_selected_by_patient - Patient's selected difficulty level (1-5)
 * @property {Date} system_timestamp - Timestamp when the system made the recommendation
 * @property {Date} created_at - Record creation timestamp
 * @property {Date} updated_at - Record last update timestamp
 */

/**
 * Difficulty level enum values
 * @readonly
 * @enum {number}
 */
const DifficultyLevel = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
  LEVEL_5: 5
};

/**
 * Validates a treatment decision object
 * @param {Object} decision - The decision object to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateTreatmentDecision(decision) {
  const errors = [];

  if (!decision.session_id) {
    errors.push('session_id is required');
  }

  if (!decision.patient_id) {
    errors.push('patient_id is required');
  }

  if (decision.suggested_difficulty === undefined || decision.suggested_difficulty === null) {
    errors.push('suggested_difficulty is required');
  } else if (
    !Number.isInteger(decision.suggested_difficulty) ||
    decision.suggested_difficulty < 1 ||
    decision.suggested_difficulty > 5
  ) {
    errors.push('suggested_difficulty must be an integer between 1 and 5');
  }

  if (decision.actual_difficulty_selected_by_patient === undefined || decision.actual_difficulty_selected_by_patient === null) {
    errors.push('actual_difficulty_selected_by_patient is required');
  } else if (
    !Number.isInteger(decision.actual_difficulty_selected_by_patient) ||
    decision.actual_difficulty_selected_by_patient < 1 ||
    decision.actual_difficulty_selected_by_patient > 5
  ) {
    errors.push('actual_difficulty_selected_by_patient must be an integer between 1 and 5');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a new treatment decision object with default values
 * @param {Object} data - The decision data
 * @returns {TreatmentDecision} A new treatment decision object
 */
function createTreatmentDecision(data) {
  const validation = validateTreatmentDecision(data);
  if (!validation.isValid) {
    throw new Error(`Invalid treatment decision: ${validation.errors.join(', ')}`);
  }

  return {
    decision_id: data.decision_id || null,
    session_id: data.session_id,
    patient_id: data.patient_id,
    suggested_difficulty: data.suggested_difficulty,
    actual_difficulty_selected_by_patient: data.actual_difficulty_selected_by_patient,
    system_timestamp: data.system_timestamp || new Date(),
    created_at: data.created_at || new Date(),
    updated_at: data.updated_at || new Date()
  };
}

module.exports = {
  DifficultyLevel,
  validateTreatmentDecision,
  createTreatmentDecision
};
