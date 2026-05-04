import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { io } from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SOCKET_URL = 'http://localhost:5000';

const ActiveMonitor = () => {
  const [metrics, setMetrics] = useState({
    hr: null,
    spo2: null,
    stressScore: null,
    vrState: 'Waiting for VR data...',
    difficulty: 'None',
    timestamp: null,
    sessionId: null,
    patientId: null,
    isWarning: false,
    isEmergency: false
  });
  const [dataHistory, setDataHistory] = useState([]);
  const [previousMetrics, setPreviousMetrics] = useState(null);

  // Patient baseline data (mock for now - will be fetched from API)
  const [patientBaseline, setPatientBaseline] = useState({
    avg_resting_hr: 75,
    avg_resting_stress: 20,
    calibrated_at: new Date().toISOString()
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastPacketTime, setLastPacketTime] = useState(null);

  const socketRef = useRef(null);
  const metricsRef = useRef(null);

  const normalizeLiveMetrics = (data) => {
    return {
      hr: data.hr ?? data.heartRate ?? data.vitals?.heartRate ?? null,
      spo2: data.spo2 ?? data.vitals?.spo2 ?? null,
      stressScore: data.stressScore ?? data.vitals?.stressScore ?? null,
      vrState: data.vrState ?? data.flightState ?? data.vrStateName ?? 'Unknown',
      difficulty: data.difficulty ?? 'None',
      timestamp: data.timestamp ?? new Date().toISOString(),
      sessionId: data.sessionId ?? null,
      patientId: data.patientId ?? null,
      isWarning: data.isWarning ?? false,
      isEmergency: data.isEmergency ?? false
    };
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString();
  };

  const displayValue = (value, fallback = 'Waiting...') => {
    return value === null || value === undefined ? fallback : value;
  };

  const chartData = {
    labels: dataHistory.map(item => formatTime(item.timestamp)),
    datasets: [
      {
        label: 'Heart Rate',
        data: dataHistory.map(item => item.hr),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: false,
        yAxisID: 'y'
      },
      {
        label: 'Stress Score',
        data: dataHistory.map(item => item.stressScore),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false,
        yAxisID: 'y1'
      },
      {
        label: 'Baseline HR',
        data: Array(dataHistory.length).fill(patientBaseline.avg_resting_hr),
        borderColor: 'rgb(107, 114, 128)',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y'
      },
      {
        label: 'Baseline Stress',
        data: Array(dataHistory.length).fill(patientBaseline.avg_resting_stress),
        borderColor: 'rgb(156, 163, 175)',
        borderDash: [3, 3],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12,
            family: 'system-ui'
          }
        }
      },
      title: {
        display: true,
        text: 'Real-time Biometric Monitoring',
        font: {
          size: 16,
          family: 'system-ui'
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Heart Rate (BPM)'
        },
        suggestedMin: 50,
        suggestedMax: 120
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Stress Score'
        },
        suggestedMin: 0,
        suggestedMax: 100,
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  useEffect(() => {
    console.log('[ActiveMonitor] Connecting to Socket.io:', SOCKET_URL);

    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('[ActiveMonitor] Connected to backend socket:', socketRef.current.id);
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('[ActiveMonitor] Disconnected from backend socket:', reason);
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('[ActiveMonitor] Socket connection error:', error.message);
      setIsConnected(false);
    });

    socketRef.current.on('live_metrics', (data) => {
      console.log('[ActiveMonitor] live_metrics received:', data);

      const mappedData = normalizeLiveMetrics(data);

      console.log('[ActiveMonitor] mapped real metrics:', mappedData);

      setPreviousMetrics(metricsRef.current);
      metricsRef.current = mappedData;

      setMetrics(mappedData);
      setLastPacketTime(mappedData.timestamp);

      setDataHistory(prev => {
        const newHistory = [...prev, mappedData];
        return newHistory.slice(-60);
      });
    });

    socketRef.current.on('distress_alert', (alert) => {
      console.log('[ActiveMonitor] distress_alert received:', alert);
    });

    socketRef.current.on('EMERGENCY_STOP', (data) => {
      console.error('[ActiveMonitor] EMERGENCY_STOP received:', data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.off('live_metrics');
        socketRef.current.off('distress_alert');
        socketRef.current.off('EMERGENCY_STOP');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const getTrendIndicator = (current, previous) => {
    if (
      current === null ||
      current === undefined ||
      previous === null ||
      previous === undefined
    ) {
      return null;
    }

    if (current > previous) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    if (current < previous) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  const getTrendColor = (current, previous) => {
    if (
      current === null ||
      current === undefined ||
      previous === null ||
      previous === undefined
    ) {
      return 'text-gray-500';
    }

    if (current > previous) return 'text-red-500';
    if (current < previous) return 'text-green-500';

    return 'text-gray-500';
  };

  const heartRateDisplay = displayValue(metrics?.hr);
  const spo2Display =
    metrics?.spo2 === null || metrics?.spo2 === undefined
      ? 'N/A'
      : metrics.spo2;
  const stressDisplay = displayValue(metrics?.stressScore);
  const vrStateDisplay = metrics?.vrState ?? 'Waiting for VR data...';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Active Monitor</h1>
        <p className="text-gray-600 mt-1">Real-time Patient Biometric Monitoring</p>

        <div className="mt-3 flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${isConnected
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
              }`}
          >
            Socket: {isConnected ? 'Connected' : 'Disconnected'}
          </span>

          <span className="text-sm text-gray-500">
            Last packet: {lastPacketTime ? formatTime(lastPacketTime) : 'Waiting...'}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Heart Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {heartRateDisplay}
                <span className="text-lg text-gray-500 ml-1">BPM</span>
              </p>
            </div>

            <div className={getTrendColor(metrics?.hr, previousMetrics?.hr)}>
              {getTrendIndicator(metrics?.hr, previousMetrics?.hr)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SpO2</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {spo2Display}
                <span className="text-lg text-gray-500 ml-1">
                  {spo2Display === 'N/A' ? '' : '%'}
                </span>
              </p>
            </div>

            <div className="text-blue-500">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stress Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stressDisplay}
                <span className="text-lg text-gray-500 ml-1">/100</span>
              </p>
            </div>
            <div className={getTrendColor(metrics?.stressScore, previousMetrics?.stressScore)}>
              {getTrendIndicator(metrics?.stressScore, previousMetrics?.stressScore)}
            </div>
          </div>
        </div>
      </div>

      {/* Baseline Comparison */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Baseline Comparison</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-600">Heart Rate</p>
              <p className="text-lg font-bold text-gray-900">
                Current: {metrics.hr} BPM
              </p>
              <p className="text-sm text-gray-500">
                Baseline: {patientBaseline.avg_resting_hr} BPM
              </p>
            </div>
            <div className="text-2xl">
              {metrics.hr > patientBaseline.avg_resting_hr ? (
                <span className="text-red-600">↑</span>
              ) : (
                <span className="text-green-600">→</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-600">Stress Score</p>
              <p className="text-lg font-bold text-gray-900">
                Current: {metrics.stressScore}
              </p>
              <p className="text-sm text-gray-500">
                Baseline: {patientBaseline.avg_resting_stress}
              </p>
            </div>
            <div className="text-2xl">
              {metrics.stressScore > patientBaseline.avg_resting_stress ? (
                <span className="text-red-600">↑</span>
              ) : (
                <span className="text-green-600">→</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VR State Display */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center">
          <svg className="w-6 h-6 mr-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>

          <span className="text-sm font-medium text-gray-600">Current VR State:</span>

          <span className="ml-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
            {vrStateDisplay}
          </span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {dataHistory.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            Waiting for real smartwatch data...
          </div>
        ) : (
          <div style={{ height: '400px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveMonitor;