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

const ActiveMonitor = () => {
  const [metrics, setMetrics] = useState({
    hr: 75,
    spo2: 98,
    stressScore: 25,
    vrState: 'Boarding',
    isWarning: false,
    isEmergency: false,
    timestamp: new Date().toISOString()
  });

  const [dataHistory, setDataHistory] = useState([]);
  const [previousMetrics, setPreviousMetrics] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // Chart configuration
  const chartData = {
    labels: dataHistory.map(item => new Date(item.timestamp).toLocaleTimeString()),
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
        data: Array(dataHistory.length).fill(80),
        borderColor: 'rgb(107, 114, 128)',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
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
          drawOnChartArea: false,
        }
      }
    }
  };

  // WebSocket connection
  useEffect(() => {
    // Try to connect to real WebSocket
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to WebSocket server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from WebSocket server');
    });

    socketRef.current.on('live_metrics', (data) => {
      setPreviousMetrics(metrics);
      // Map backend payload structure to frontend expected structure
      const mappedData = {
        hr: data.vitals?.heartRate || 0,
        spo2: data.vitals?.spo2 || 0,
        stressScore: data.vitals?.stressScore || 0,
        vrState: data.vrState || 'Unknown',
        timestamp: data.timestamp,
        sessionId: data.sessionId,
        isWarning: data.isWarning || false,
        isEmergency: data.isEmergency || false
      };
      setMetrics(mappedData);
      setDataHistory(prev => {
        const newHistory = [...prev, mappedData];
        return newHistory.slice(-60); // Keep last 60 data points
      });
    });

    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isConnected, metrics]);

  // Calculate trend indicators with visual SVG arrows
  const getTrendIndicator = (current, previous) => {
    if (!previous) return null;
    if (current > previous) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    if (current < previous) {
      return (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    );
  };

  const getTrendColor = (current, previous) => {
    if (!previous) return 'text-gray-500';
    if (current > previous) return 'text-red-500';
    if (current < previous) return 'text-green-500';
    return 'text-gray-500';
  };

  
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Active Monitor</h1>
        <p className="text-gray-600 mt-1">Real-time Patient Biometric Monitoring</p>
      </div>

      
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Heart Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics.hr}
                <span className="text-lg text-gray-500 ml-1">BPM</span>
              </p>
            </div>
            <div className={getTrendColor(metrics.hr, previousMetrics?.hr)}>
              {getTrendIndicator(metrics.hr, previousMetrics?.hr)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SpO2</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics.spo2}
                <span className="text-lg text-gray-500 ml-1">%</span>
              </p>
            </div>
            <div className="text-blue-500">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stress Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {metrics.stressScore}
                <span className="text-lg text-gray-500 ml-1">/100</span>
              </p>
            </div>
            <div className={getTrendColor(metrics.stressScore, previousMetrics?.stressScore)}>
              {getTrendIndicator(metrics.stressScore, previousMetrics?.stressScore)}
            </div>
          </div>
        </div>
      </div>

      {/* VR State Display */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center">
          <svg className="w-6 h-6 mr-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-gray-600">Current VR State:</span>
          <span className="ml-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
            {metrics.vrState}
          </span>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div style={{ height: '400px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

          </div>
  );
};

export default ActiveMonitor;
