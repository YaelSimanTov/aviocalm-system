import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Heart, Wind, TrendingUp, Activity, Database, BarChart2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { apiRequest, api } from '../../utils/api';

// ─── Chart color palette ──────────────────────────────────────────────────────

const COLORS = {
  RELAXED:  '#a3e635',
  MODERATE: '#d946ef',
  PANIC:    '#9333ea',
};

// VR flight-phase background fills — reserved exclusively for ReferenceArea blocks
const VR_STATE_COLORS = {
  BoardingState: '#dbeafe',
  TakeOffState:  '#fed7aa',
  InFlightState: '#a7f3d0',
  LandingState:  '#e9d5ff',
  LandedState:   '#cbd5e1',
  PausedState:   '#e5e7eb',
  Default:       '#f3f4f6',
};

const STAGE_NAMES = {
  BoardingState: 'Boarding',
  TakeOffState:  'Takeoff',
  InFlightState: 'Cruising',
  LandingState:  'Landing',
  LandedState:   'Completed',
  PausedState:   'Paused',
};

const LEGEND_STAGES = [
  { state: 'BoardingState', label: 'Boarding'  },
  { state: 'TakeOffState',  label: 'Takeoff'   },
  { state: 'InFlightState', label: 'Cruising'  },
  { state: 'LandingState',  label: 'Landing'   },
  { state: 'LandedState',   label: 'Completed' },
];

// Per-type colors for alert annotations — severity-based palette.
// Safety:      Red  (#ef4444) — Critical / absolute danger
// Panic:       Teal (#14b8a6) — High / sustained anxiety; teal avoids blending with the blue/purple chart lines
// Statistical: Amber (#f59e0b) — Warning / relative anomaly
const ALERT_ANNOTATION_COLORS = {
  Safety:     '#ef4444',
  Panic:      '#14b8a6',
  Statistical:'#f59e0b',
};

// ─── Helper: VR phase blocks for ReferenceArea backgrounds ───────────────────

function generateVrStateBlocks(timeSeriesData) {
  if (!timeSeriesData || timeSeriesData.length === 0) return [];
  const blocks = [];
  let currentState = timeSeriesData[0].vrState || 'Default';
  let startIndex   = 0;

  for (let i = 1; i < timeSeriesData.length; i++) {
    const entryState = timeSeriesData[i].vrState || 'Default';
    if (entryState !== currentState) {
      blocks.push({
        startIndex,
        endIndex: i - 1,
        color: VR_STATE_COLORS[currentState] || VR_STATE_COLORS.Default,
      });
      currentState = entryState;
      startIndex   = i;
    }
  }
  blocks.push({
    startIndex,
    endIndex: timeSeriesData.length - 1,
    color: VR_STATE_COLORS[currentState] || VR_STATE_COLORS.Default,
  });
  return blocks;
}

// ─── Helper: map alert breach window to nearest time-series dataIndex values ──

function mapAlertToDataIndices(alertTimestamp, durationSeconds, timeSeriesData) {
  const toMs  = (s) => new Date(s.endsWith('Z') ? s : `${s}Z`).getTime();
  const startMs = toMs(alertTimestamp);
  const endMs   = startMs + durationSeconds * 1000;

  let startIdx = 0;
  let endIdx   = timeSeriesData.length - 1;
  let minStart = Infinity;
  let minEnd   = Infinity;

  timeSeriesData.forEach((pt, i) => {
    const ptMs = toMs(pt.timestamp);
    const sd   = Math.abs(ptMs - startMs);
    const ed   = Math.abs(ptMs - endMs);
    if (sd < minStart) { minStart = sd; startIdx = i; }
    if (ed < minEnd)   { minEnd   = ed; endIdx   = i; }
  });

  return { startIdx, endIdx };
}

// ─── Helper: format ISO timestamp to local display string ────────────────────

function formatTimestamp(isoString) {
  if (!isoString) return 'N/A';
  const utc = isoString.endsWith('Z') ? isoString : `${isoString}Z`;
  return new Date(utc).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

// ─── AlertAnnotationDot ───────────────────────────────────────────────────────
// Custom SVG content for a ReferenceDot: colored "!" marker with a
// foreignObject tooltip on hover showing description and duration.

function AlertAnnotationDot({ cx, cy, alert, color, isHovered, onEnter, onLeave }) {
  if (cx == null || cy == null) return null;

  const durationLabel = alert.duration_seconds < 60
    ? `${alert.duration_seconds}s`
    : `${Math.floor(alert.duration_seconds / 60)}m ${alert.duration_seconds % 60}s`;

  // Flip tooltip to the left side when the dot is in the right half of the chart
  const tooltipX = cx > 400 ? cx - 234 : cx + 12;

  return (
    <g>
      <circle
        cx={cx} cy={cy}
        r={isHovered ? 9 : 7}
        fill={color}
        stroke="white" strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={9} fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >!</text>

      {isHovered && (
        <foreignObject x={tooltipX} y={cy - 48} width={222} height={100} style={{ overflow: 'visible' }}>
          <div style={{
            background: 'white',
            border: `2px solid ${color}`,
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '12px',
            lineHeight: '1.5',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 700, color, marginBottom: '3px' }}>
              {alert.alert_type} Alert
            </div>
            <div style={{ color: '#374151', fontSize: '11px', marginBottom: '3px' }}>
              {alert.description}
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              Duration: {durationLabel}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

// ─── Session Event Timeline Sidebar ────────────────────────────────────────────

/**
 * SessionEventTimeline — chronological event feed displayed alongside the LineChart.
 * Fetches real Unity VR events from the DB and merges them with medical alerts.
 * Each item is color-coded by Unity log tag or alert type.
 */
function SessionEventTimeline({ sessionId, sessionAlerts }) {
  const [vrEvents, setVrEvents] = useState([]);

  // Fetch persisted VR events for this session from the backend
  useEffect(() => {
    if (!sessionId) return;
    api.getVrEvents(sessionId).then((result) => {
      if (result.success && Array.isArray(result.data)) {
        setVrEvents(result.data);
      }
    });
  }, [sessionId]);

  // Convert medical alerts to unified event format
  const alertEvents = sessionAlerts.map((a) => ({
    id: a.id,
    type: 'Alert',
    tag: a.alert_type,
    description: a.description,
    timestamp: a.timestamp,
  }));

  // Convert DB VR events to unified event format
  const vrEventItems = vrEvents.map((e) => ({
    id: e.id,
    type: 'VR',
    tag: e.tag,
    description: e.message,
    timestamp: e.timestamp,
  }));

  // Merge and sort chronologically
  const allEvents = [...alertEvents, ...vrEventItems].sort((a, b) => {
    const timeA = new Date(a.timestamp.endsWith('Z') ? a.timestamp : `${a.timestamp}Z`).getTime();
    const timeB = new Date(b.timestamp.endsWith('Z') ? b.timestamp : `${b.timestamp}Z`).getTime();
    return timeA - timeB;
  });

  // Map Unity log tags and alert types to left-border Tailwind color classes
  const getBorderColor = (type, tag) => {
    if (type === 'Alert') {
      if (tag === 'Safety')      return 'border-red-500';
      if (tag === 'Panic')       return 'border-teal-500';
      if (tag === 'Statistical') return 'border-amber-500';
      return 'border-slate-400';
    }
    if (tag === '[User Action]')  return 'border-blue-500';
    if (tag === '[Flight Phase]') return 'border-slate-400';
    if (tag === '[Flight Event]') return 'border-indigo-500';
    if (tag === '[System Event]') return 'border-gray-400';
    return 'border-slate-300';
  };

  // Human-readable label shown below the event description
  const getLabel = (type, tag) => {
    if (type === 'Alert') return `${tag} Alert`;
    return tag ?? 'VR Event';
  };

  // Format timestamp for display (e.g., 08:24 AM)
  const formatTime = (iso) => {
    return new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Session Timeline</h2>
      {/* Scrollable event feed with fixed max-height matching the chart */}
      <div
        className="flex-1 overflow-y-auto bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2"
        style={{ maxHeight: '500px' }}
      >
        {allEvents.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-8">No events recorded</div>
        ) : (
          allEvents.map((event) => (
            <div
              key={event.id}
              className={`bg-white rounded p-2.5 shadow-sm border-l-4 ${getBorderColor(event.type, event.tag)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 break-words leading-relaxed">{event.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{getLabel(event.type, event.tag)}</p>
                </div>
                <p className="text-xs text-gray-400 font-mono whitespace-nowrap">{formatTime(event.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── SessionDetails page ──────────────────────────────────────────────────────

export function SessionDetails() {
  const { patientId, sessionId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [analyticsData, setAnalyticsData]       = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError]     = useState(null);
  const [sessionAlerts, setSessionAlerts]       = useState([]);
  const [hoveredAlertId, setHoveredAlertId]     = useState(null);
  // baseline_hr is the only field still sourced from the alerts endpoint
  const [sessionMeta, setSessionMeta]           = useState({ baseline_hr: null });

  // Session object forwarded by TreatmentHistory via route state.
  // Used for header date and HRV RMSSD card before analytics data arrives.
  // Falls back gracefully when the page is accessed directly by URL.
  const sessionNavState = location.state?.session ?? null;

  useEffect(() => {
    fetchAnalytics();
    fetchAlerts();
  }, [sessionId]);

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const result = await apiRequest(`/patients/sessions/${sessionId}/analytics`);
      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        setAnalyticsError(result.error || 'Failed to load analytics');
      }
    } catch {
      setAnalyticsError('Network error. Please try again.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchAlerts = async () => {
    const result = await api.getSessionAlerts(sessionId);
    if (result.success && result.data) {
      setSessionAlerts(result.data.alerts ?? []);
      setSessionMeta({ baseline_hr: result.data.baseline_hr ?? null });
    }
  };

  // Navigate back to the patient profile, landing on the history tab
  const handleBack = () => {
    navigate(`/patients/${patientId}`, { state: { targetTab: 'history' } });
  };

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = analyticsData?.timeSeriesData?.map((d, i) => ({ ...d, dataIndex: i })) ?? [];
  const vrBlocks  = generateVrStateBlocks(chartData);

  // Derive session start date from route state, or fall back to first analytics point
  const sessionDate = sessionNavState?.started_at
    ?? analyticsData?.timeSeriesData?.[0]?.timestamp
    ?? null;

  // ── KPI cards — values read from pre-computed columns in the sessions table ──

  const kpiCards = (() => {
    // Use an empty object as fallback so all four cards always render with 'N/A'
    // values when precomputedKPIs is absent (e.g., session ended with zero data points).
    const kpis = analyticsData?.precomputedKPIs ?? {};
    const hrv  = sessionNavState?.overall_hrv_rmssd ?? null;

    return [
      { label: 'Avg Heart Rate',   value: kpis.avg_heart_rate   != null ? String(kpis.avg_heart_rate)             : 'N/A', unit: kpis.avg_heart_rate   != null ? 'BPM'   : null, Icon: Heart,      iconColor: 'text-blue-600',    iconBg: 'bg-blue-50'    },
      { label: 'Avg SpO₂',         value: kpis.avg_spo2         != null ? String(kpis.avg_spo2)                   : 'N/A', unit: kpis.avg_spo2         != null ? '%'     : null, Icon: Wind,       iconColor: 'text-teal-600',    iconBg: 'bg-teal-50'    },
      { label: 'Avg Stress Score',  value: kpis.avg_stress_score != null ? Number(kpis.avg_stress_score).toFixed(1): 'N/A', unit: kpis.avg_stress_score != null ? '/ 100' : null, Icon: TrendingUp, iconColor: 'text-purple-600',  iconBg: 'bg-purple-50'  },
      { label: 'HRV RMSSD',         value: hrv                   != null ? String(hrv)                            : 'N/A', unit: hrv                   != null ? 'ms'    : null, Icon: Activity,   iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50' },
    ];
  })();

  // ── Pie chart data — percentages from pre-computed sessions columns ──────────

  const pieData = analyticsData?.timeInRangeDistribution
    ? [
        { name: 'Relaxed',  value: analyticsData.timeInRangeDistribution.relaxed,  color: COLORS.RELAXED  },
        { name: 'Moderate', value: analyticsData.timeInRangeDistribution.moderate, color: COLORS.MODERATE },
        { name: 'Panic',    value: analyticsData.timeInRangeDistribution.panic,     color: COLORS.PANIC    },
      ]
    : [];

  // ── Session volume meta (total_data_points sourced from sessions table KPIs) ─

  const totalDataPoints = analyticsData?.precomputedKPIs?.total_data_points ?? 0;
  const windowCount     = Math.floor(totalDataPoints / 3);

  // ── Loading state ───────────────────────────────────────────────────────────

  if (analyticsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading session data…</p>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  if (analyticsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-medium">{analyticsError}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
        <button onClick={handleBack} className="text-sm text-gray-500 hover:underline">
          Back to Patient Profile
        </button>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top navigation bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Patient Profile
          </button>

          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">Session Dashboard</h1>
            {sessionDate && (
              <p className="text-xs text-gray-500 mt-0.5">{formatTimestamp(sessionDate)}</p>
            )}
          </div>

          {/* Right spacer keeps the title visually centred */}
          <div className="w-[180px]" />
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Clinical KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(({ label, value, unit, Icon, iconColor, iconBg }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4"
            >
              <div className={`w-11 h-11 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight">
                  {value}
                  {unit && (
                    <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Session volume meta-cards — data-level stats, visually lighter than clinical KPIs */}
        {(totalDataPoints > 0 || windowCount > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Data Points', value: totalDataPoints, Icon: Database },
              { label: 'Time Windows',       value: windowCount,     Icon: BarChart2 },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
                  <p className="text-xl font-semibold text-gray-600">{value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Line chart with timeline sidebar — split layout: chart 72%, sidebar 28% */}
        <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Vitals Over Time</h2>

          {/* Flex container: chart on left, timeline sidebar on right */}
          <div className="flex gap-4">
            {/* Chart area — 72% width */}
            <div className="w-[72%] flex flex-col">
              {/* VR stage colour legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3">
                {LEGEND_STAGES.map(({ state, label }) => (
                  <div key={state} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: VR_STATE_COLORS[state],
                        opacity: 0.85,
                        borderRadius: 3,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                  </div>
                ))}
              </div>

              {chartData.length > 0 ? (
                <>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>

                  {/* VR phase background fills — reserved for flight-phase context only */}
                  {vrBlocks.map((block, i) => (
                    <ReferenceArea
                      key={`bg-${i}`}
                      x1={block.startIndex}
                      x2={block.endIndex}
                      yAxisId="left"
                      fill={block.color}
                      fillOpacity={0.7}
                      strokeOpacity={0}
                    />
                  ))}

                  {/* Alert duration ribbons — bound to the hidden ribbonAxis so the band
                      position is independent of the dynamic HR/Stress scales.
                      y1=95 / y2=100 always occupies exactly the top 5% of chart height.
                      Rendered before CartesianGrid so grid lines remain fully visible. */}
                  {sessionAlerts.map((alert) => {
                    const { startIdx, endIdx } = mapAlertToDataIndices(
                      alert.timestamp, alert.duration_seconds, chartData
                    );
                    const color = ALERT_ANNOTATION_COLORS[alert.alert_type] ?? '#6b7280';
                    return (
                      <ReferenceArea
                        key={`ribbon-${alert.id}`}
                        x1={startIdx}
                        x2={endIdx}
                        y1={95}
                        y2={100}
                        yAxisId="ribbonAxis"
                        fill={color}
                        fillOpacity={0.6}
                        strokeOpacity={0}
                      />
                    );
                  })}

                  <CartesianGrid strokeDasharray="3 3" />
                  {/* Horizontal baseline HR line — uses the real resting HR calibrated at
                      session start from patient_baselines, not an estimated fallback.
                      Rendered in green to distinguish it from the alert markers (red/orange/purple). */}
                  {sessionMeta.baseline_hr !== null && (
                    <ReferenceLine
                      y={Number(sessionMeta.baseline_hr)}
                      yAxisId="left"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="8 4"
                      label={{
                        position: 'insideTopLeft',
                        value: `Baseline HR: ${Math.round(sessionMeta.baseline_hr)} BPM`,
                        fill: '#059669',
                        fontSize: 11,
                        fontWeight: 'bold',
                      }}
                    />
                  )}
                  <XAxis
                    type="number"
                    dataKey="dataIndex"
                    domain={[0, chartData.length - 1]}
                    tickFormatter={(val) =>
                      chartData[val]?.timestamp
                        ? new Date(chartData[val].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''
                    }
                    minTickGap={15}
                    angle={-35}
                    textAnchor="end"
                    height={55}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    // Lower bound: whichever is smaller — 10 BPM below data min, or
                    // 5 BPM below baseline HR — so the green baseline line is always visible
                    // even when resting HR is below the session's active heart rate range.
                    domain={[
                      (dataMin) => sessionMeta.baseline_hr
                        ? Math.min(dataMin - 10, Number(sessionMeta.baseline_hr) - 5)
                        : dataMin - 10,
                      (dataMax) => dataMax + 10,
                    ]}
                    // Round tick values to avoid floating-point rendering artifacts
                    tickFormatter={(value) => Math.round(value)}
                    label={{ value: 'Heart Rate (BPM)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#3b82f6', fontWeight: 'bold' } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    // Round tick values to avoid floating-point rendering artifacts
                    tickFormatter={(value) => Math.round(value)}
                    label={{ value: 'Stress Score', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#8b5cf6', fontWeight: 'bold' } }}
                  />
                  {/* Hidden axis used exclusively by the alert-ribbon ReferenceAreas.
                      Fixed domain [0, 100] ensures y1=95 / y2=100 always maps to exactly
                      the top 5% of chart height, regardless of the HR or Stress scales. */}
                  <YAxis yAxisId="ribbonAxis" type="number" domain={[0, 100]} hide={true} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const d = payload[0].payload;
                      const stageName = STAGE_NAMES[d.vrState] || d.vrState || 'Unknown';

                      // Normalise an ISO string to ms, adding 'Z' suffix if absent
                      const toMs = (iso) =>
                        new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
                      const toTime = (iso) =>
                        new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                        });

                      // Find alerts whose time window covers the currently hovered data point
                      const pointMs = toMs(d.timestamp);
                      const activeAlerts = sessionAlerts.filter((a) => {
                        const start = toMs(a.timestamp);
                        const end   = start + a.duration_seconds * 1000;
                        return pointMs >= start && pointMs <= end;
                      });

                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1 max-w-xs">
                          <p className="font-semibold text-gray-700">
                            {new Date(d.timestamp.endsWith('Z') ? d.timestamp : `${d.timestamp}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                          <p className="text-blue-600">Heart Rate: <strong>{d.avgHeartRate} BPM</strong></p>
                          <p className="text-purple-600">Stress Score: <strong>{d.avgStressScore}</strong></p>
                          <p className="text-teal-600">SpO₂: <strong>{d.avgSpo2 ? `${d.avgSpo2}%` : 'N/A'}</strong></p>
                          <p className="text-gray-500">Stage: {stageName} ({d.difficulty})</p>

                          {/* Alert details section — injected only when the hovered point
                              falls inside one or more alert breach windows */}
                          {activeAlerts.length > 0 && (
                            <div className="border-t border-gray-200 mt-2 pt-2 space-y-2">
                              {activeAlerts.map((a) => {
                                const color   = ALERT_ANNOTATION_COLORS[a.alert_type] ?? '#6b7280';
                                const endIso  = new Date(
                                  toMs(a.timestamp) + a.duration_seconds * 1000
                                ).toISOString();
                                return (
                                  <div key={a.id}>
                                    <p className="font-bold" style={{ color }}>
                                      ⚠ {a.alert_type} Alert
                                    </p>
                                    <p className="text-gray-500">Start:    {toTime(a.timestamp)}</p>
                                    <p className="text-gray-500">End:      {toTime(endIso)}</p>
                                    <p className="text-gray-500">Duration: {a.duration_seconds}s</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line yAxisId="left"  type="monotone" dataKey="avgHeartRate"   stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="avgStressScore" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  {/* Alert annotations — declared AFTER Line elements so the SVG paint order
                      puts dots and vertical lines on TOP of the chart lines, not under them.
                      ReferenceArea is intentionally NOT used here (reserved for VR backgrounds).
                      Each alert: solid start line | dashed end line | hoverable dot. */}
                  {sessionAlerts.map((alert) => {
                    const { startIdx, endIdx } = mapAlertToDataIndices(
                      alert.timestamp, alert.duration_seconds, chartData
                    );
                    const color   = ALERT_ANNOTATION_COLORS[alert.alert_type] ?? '#6b7280';
                    // Use null (not 0) as fallback — y=0 is outside the visible HR domain
                    // and would cause the dot to be clipped off-screen.
                    const hrValue = chartData[startIdx]?.avgHeartRate ?? null;

                    return (
                      <React.Fragment key={`alert-${alert.id}`}>
                        {/* Solid vertical line at breach start */}
                        <ReferenceLine x={startIdx} yAxisId="left" stroke={color} strokeWidth={2} />
                        {/* Dashed vertical line at breach end (omitted when same data point) */}
                        {endIdx !== startIdx && (
                          <ReferenceLine x={endIdx} yAxisId="left" stroke={color} strokeWidth={1.5} strokeDasharray="4 3" />
                        )}
                        {/* Interactive dot — only rendered when the chart has a valid HR reading
                            at the alert position so it is never placed off-screen. */}
                        {hrValue !== null && (
                          <ReferenceDot
                            x={startIdx}
                            y={hrValue}
                            yAxisId="left"
                            r={0}
                            content={(props) => (
                              <AlertAnnotationDot
                                {...props}
                                alert={alert}
                                color={color}
                                isHovered={hoveredAlertId === alert.id}
                                onEnter={() => setHoveredAlertId(alert.id)}
                                onLeave={() => setHoveredAlertId(null)}
                              />
                            )}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>

              {/* Alert type legend — all 3 channels always shown with full legibility,
                  ordered by severity (Critical -> High -> Warning). */}
              <div className="mt-3 flex flex-wrap gap-4 border-t border-gray-100 pt-3">
                <span className="font-semibold text-gray-700 mr-2 text-xs self-center">Alert Types:</span>
                {['Safety', 'Panic', 'Statistical'].map((type) => {
                  const colorClass = type === 'Safety' ? 'bg-red-500'
                                  : type === 'Panic' ? 'bg-teal-500'
                                  : 'bg-amber-500';
                  return (
                    <div key={type} className="flex items-center gap-1.5 text-xs text-gray-700">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorClass}`} />
                      {type}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              No time-series data available
            </div>
          )}
            </div>

            {/* Sidebar area — 28% width */}
            <div className="w-[28%]">
              <SessionEventTimeline sessionId={sessionId} sessionAlerts={sessionAlerts} />
            </div>
          </div>
        </div>

        {/* Pie chart — stress range distribution, placed below the line chart */}
        <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Time in Stress Range</h2>

          {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${name}: ${value}%`]} />
                </PieChart>
              </ResponsiveContainer>

              {/* Pie legend */}
              <div className="flex justify-center gap-6 mt-3">
                {pieData.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span>{name}: <strong>{value}%</strong></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              No distribution data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionDetails;
