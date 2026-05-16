/**
 * SessionDifficultyLevel Entity/DTO
 * Represents a difficulty level change within a session
 * Part of Epic 4, User Story 4.3: Asynchronous Recommendation & Audit
 */

/**
 * @typedef {Object} SessionDifficultyLevel
 * @property {string} id - Unique identifier for the difficulty level record
 * @property {string} session_id - Reference to the session
 * @property {number} difficulty_level - Difficulty level (1-5)
 * @property {Date} started_at - Timestamp when this difficulty level started
 * @property {Date} ended_at - Timestamp when this difficulty level ended (null if active)
 * @property {number} duration_seconds - Duration in seconds (null if active)
 * @property {string} vr_state - VR state during this difficulty level
 * @property {Date} created_at - Record creation timestamp
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
 * Validates a session difficulty level object
 * @param {Object} difficultyLevel - The difficulty level object to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateSessionDifficultyLevel(difficultyLevel) {
  const errors = [];

  if (!difficultyLevel.session_id) {
    errors.push('session_id is required');
  }

  if (difficultyLevel.difficulty_level === undefined || difficultyLevel.difficulty_level === null) {
    errors.push('difficulty_level is required');
  } else if (
    !Number.isInteger(difficultyLevel.difficulty_level) ||
    difficultyLevel.difficulty_level < 1 ||
    difficultyLevel.difficulty_level > 5
  ) {
    errors.push('difficulty_level must be an integer between 1 and 5');
  }

  if (!difficultyLevel.started_at) {
    errors.push('started_at is required');
  }

  if (difficultyLevel.ended_at && difficultyLevel.started_at > difficultyLevel.ended_at) {
    errors.push('ended_at must be after started_at');
  }

  if (difficultyLevel.duration_seconds !== undefined && difficultyLevel.duration_seconds !== null) {
    if (!Number.isInteger(difficultyLevel.duration_seconds) || difficultyLevel.duration_seconds < 0) {
      errors.push('duration_seconds must be a non-negative integer');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a new session difficulty level object with default values
 * @param {Object} data - The difficulty level data
 * @returns {SessionDifficultyLevel} A new session difficulty level object
 */
function createSessionDifficultyLevel(data) {
  const validation = validateSessionDifficultyLevel(data);
  if (!validation.isValid) {
    throw new Error(`Invalid session difficulty level: ${validation.errors.join(', ')}`);
  }

  return {
    id: data.id || null,
    session_id: data.session_id,
    difficulty_level: data.difficulty_level,
    started_at: data.started_at || new Date(),
    ended_at: data.ended_at || null,
    duration_seconds: data.duration_seconds || null,
    vr_state: data.vr_state || null,
    created_at: data.created_at || new Date()
  };
}

module.exports = {
  DifficultyLevel,
  validateSessionDifficultyLevel,
  createSessionDifficultyLevel
};
