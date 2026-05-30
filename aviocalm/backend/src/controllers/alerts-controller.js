const pool = require('../config/db');

// GET /api/alerts/unread
// Returns all unread alerts joined with patient name and national ID,
// ordered newest first so the dropdown surfaces the most recent events.
const getUnreadAlerts = async (req, res) => {
  try {
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
      ORDER BY a.created_at DESC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ALERTS] Failed to fetch unread alerts:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
};

// PATCH /api/alerts/:id/read
// Marks a single alert as read. Returns 404 if the ID is not found.
const markAlertRead = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'UPDATE alerts SET is_read = true WHERE id = $1 RETURNING id',
      [id]
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
