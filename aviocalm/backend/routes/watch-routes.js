const express = require("express");
const router = express.Router();
const pool = require("../config/db");

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
      ]);

    console.log("Watch data saved:", result.rows[0]);

    return res.status(200).json({
      success: true,
      message: "Watch data saved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Watch data error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while receiving watch data",
    });
  }
});

module.exports = router;