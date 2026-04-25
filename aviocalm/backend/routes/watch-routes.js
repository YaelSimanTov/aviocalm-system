const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Calculate a simple stress score based on heart rate and SpO2
function calculateStressScore(heartRate, spo2) {
  let score = 0;

  if (heartRate >= 110) {
    score += 60;
  } else if (heartRate >= 100) {
    score += 45;
  } else if (heartRate >= 90) {
    score += 30;
  } else if (heartRate >= 80) {
    score += 15;
  } else {
    score += 5;
  }

  if (spo2 !== null && spo2 !== undefined) {
    if (spo2 < 90) {
      score += 40;
    } else if (spo2 < 94) {
      score += 25;
    } else if (spo2 < 96) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

// Detect distress based on biometric thresholds
function detectDistressAlert(heartRate, spo2, stressScore) {
  if (spo2 !== null && spo2 !== undefined && spo2 < 92) {
    return {
      distressAlert: true,
      alertReason: "Low SpO2",
    };
  }

  if (heartRate >= 100) {
    return {
      distressAlert: true,
      alertReason: "High heart rate",
    };
  }

  if (stressScore >= 70) {
    return {
      distressAlert: true,
      alertReason: "High stress score",
    };
  }

  return {
    distressAlert: false,
    alertReason: null,
  };
}

// Receive and save watch biometric data
router.post("/data", async (req, res) => {
  try {
    const { heartRate, spo2, timestamp, patientId, sessionId } = req.body;

    if (heartRate === undefined || heartRate === null) {
      return res.status(400).json({
        success: false,
        message: "heartRate is required",
      });
    }

    const heartRateNumber = Math.round(Number(heartRate));

    const spo2Number =
      spo2 === null || spo2 === undefined ? null : Math.round(Number(spo2));

    const stressScore = calculateStressScore(heartRateNumber, spo2Number);

    const recordedAt = timestamp ? new Date(timestamp) : new Date();

    const result = await pool.query(
      `
      INSERT INTO watch_measurements
        (patient_id, session_id, heart_rate, spo2, stress_score, recorded_at)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        patientId || null,
        sessionId || null,
        heartRateNumber,
        spo2Number,
        stressScore,
        recordedAt,
      ]
    );

    const savedMeasurement = result.rows[0];

    const alert = detectDistressAlert(
      savedMeasurement.heart_rate,
      savedMeasurement.spo2,
      savedMeasurement.stress_score
    );

    console.log("Watch data saved:", {
      ...savedMeasurement,
      distress_alert: alert.distressAlert,
      alert_reason: alert.alertReason,
    });

    return res.status(200).json({
      success: true,
      message: "Watch data saved successfully",
      data: {
        id: savedMeasurement.id,
        patientId: savedMeasurement.patient_id,
        sessionId: savedMeasurement.session_id,
        heartRate: savedMeasurement.heart_rate,
        spo2: savedMeasurement.spo2,
        stressScore: savedMeasurement.stress_score,
        recordedAt: savedMeasurement.recorded_at,
        createdAt: savedMeasurement.created_at,
        distressAlert: alert.distressAlert,
        alertReason: alert.alertReason,
      },
    });
  } catch (error) {
    console.error("Watch data error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while receiving watch data",
    });
  }
});

// Get latest watch measurement
router.get("/latest", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        patient_id,
        session_id,
        heart_rate,
        spo2,
        stress_score,
        recorded_at,
        created_at
      FROM watch_measurements
      ORDER BY recorded_at DESC
      LIMIT 1
      `
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No watch measurements found",
      });
    }

    const row = result.rows[0];

    const alert = detectDistressAlert(
      row.heart_rate,
      row.spo2,
      row.stress_score
    );

    return res.status(200).json({
      success: true,
      data: {
        id: row.id,
        patientId: row.patient_id,
        sessionId: row.session_id,
        heartRate: row.heart_rate,
        spo2: row.spo2,
        stressScore: row.stress_score,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
        distressAlert: alert.distressAlert,
        alertReason: alert.alertReason,
      },
    });
  } catch (error) {
    console.error("Get latest watch data error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching latest watch data",
    });
  }
});

// Get recent watch measurements
router.get("/recent", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;

    const result = await pool.query(
      `
      SELECT
        id,
        patient_id,
        session_id,
        heart_rate,
        spo2,
        stress_score,
        recorded_at,
        created_at
      FROM watch_measurements
      ORDER BY recorded_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const data = result.rows.map((row) => {
      const alert = detectDistressAlert(
        row.heart_rate,
        row.spo2,
        row.stress_score
      );

      return {
        id: row.id,
        patientId: row.patient_id,
        sessionId: row.session_id,
        heartRate: row.heart_rate,
        spo2: row.spo2,
        stressScore: row.stress_score,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
        distressAlert: alert.distressAlert,
        alertReason: alert.alertReason,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Get recent watch data error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching recent watch data",
    });
  }
});

module.exports = router;