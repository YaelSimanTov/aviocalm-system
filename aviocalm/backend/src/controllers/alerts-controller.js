const pool = require('../config/db');

// GET /api/alerts/unread
// Returns unread alerts scoped to the requesting clinician's own patients only.
// Owner accounts have no patient assignments and always receive an empty list.
const getUnreadAlerts = async (req, res) => {
  const { userId, role } = req.user;

  // Owners do not manage individual patients, so they never receive alerts.
  if (role === 'Owner') {
    return res.json({ success: true, data: [] });
  }

  try {
    // Filter by therapist_id so that each clinician sees only their own patients' alerts.
    const { rows } = await pool.query(`
      SELECT
        a.id,
        a.patient_id,
        a.session_id,
        a.timestamp,
        a.duration_seconds,
        a.alert_type,
        a.description,
        a.is_read,
        a.created_at,
        p.full_name       AS patient_name,
        p.national_id     AS patient_national_id
      FROM alerts a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.is_read = false
        AND p.therapist_id = $1
      ORDER BY a.created_at DESC
    `, [userId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ALERTS] Failed to fetch unread alerts:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
};

// PATCH /api/alerts/:id/read
// Marks a single alert as read. Clinicians may only mark alerts for their own
// patients, preventing unauthorised cross-clinician reads (IDOR guard).
const markAlertRead = async (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.user;

  try {
    // Build a query that verifies ownership before updating.
    // Owners are blocked entirely — they should never receive alerts.
    if (role === 'Owner') {
      return res.status(403).json({ success: false, error: 'Not authorised to manage alerts' });
    }

    const { rows } = await pool.query(
      `UPDATE alerts
       SET    is_read = true
       FROM   patients p
       WHERE  alerts.id         = $1
         AND  alerts.patient_id = p.id
         AND  p.therapist_id    = $2
       RETURNING alerts.id`,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    res.json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    console.error('[ALERTS] Failed to mark alert as read:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
};

module.exports = { getUnreadAlerts, markAlertRead };
