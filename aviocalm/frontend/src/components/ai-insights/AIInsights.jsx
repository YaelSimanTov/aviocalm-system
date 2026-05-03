import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const AIInsights = () => {
  const [showProgressionCard, setShowProgressionCard] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [recommendation, setRecommendation] = useState({
    action: 'Proceed to Next Level',
    color: 'green',
    reason: 'Patient shows excellent stress management and recovery patterns'
  });
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket server
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('AI Insights connected to WebSocket server');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('AI Insights disconnected from WebSocket server');
    });

    // Listen for progression recommendations from server
    socketRef.current.on('progression_recommendation', (data) => {
      setRecommendation(data);
      setShowProgressionCard(true);
    });

    // Mock progression recommendation for testing
    const mockInterval = setInterval(() => {
      if (!isConnected) {
        setShowProgressionCard(true);
      }
    }, 15000); // Show every 15 seconds for testing

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      clearInterval(mockInterval);
    };
  }, [isConnected]);

  const handleProgressionFeedback = (agreed) => {
    console.log(`Therapist ${agreed ? 'agreed' : 'disagreed'} with system recommendation`);
    setShowProgressionCard(false);
    
    // Send feedback to server
    if (socketRef.current) {
      socketRef.current.emit('progression_feedback', { 
        agreed, 
        recommendation: recommendation.action,
        timestamp: new Date().toISOString() 
      });
    }
  };

  const getRecommendationColor = (color) => {
    switch (color) {
      case 'green':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getButtonColor = (color) => {
    switch (color) {
      case 'green':
        return 'bg-green-600 hover:bg-green-700';
      case 'yellow':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'red':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Insights</h1>
        <p className="text-gray-600 mt-1">System recommendations and progression analysis</p>
      </div>

      {/* Connection Status */}
      <div className="mb-6">
        <div className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? 'Connected to AI Engine' : 'Disconnected'}
        </div>
      </div>

      {/* Progression Recommendation Modal */}
      {showProgressionCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${getRecommendationColor(recommendation.color)}`}>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Scene Completed</h3>
              <div className={`mb-6 p-4 rounded-lg border ${getRecommendationColor(recommendation.color)}`}>
                <p className="text-sm font-medium mb-1">System Recommendation:</p>
                <p className="font-bold">{recommendation.action}</p>
                <p className="text-xs mt-2">{recommendation.reason}</p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleProgressionFeedback(true)}
                  className={`flex-1 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 ${getButtonColor(recommendation.color)}`}
                >
                  Agree
                </button>
                <button
                  onClick={() => handleProgressionFeedback(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Disagree
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Progress Analysis */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Progress Analysis</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Current Session Performance</h3>
              <div className="text-sm text-blue-700">
                <p>• Stress Recovery Rate: 85%</p>
                <p>• Baseline Adherence: Excellent</p>
                <p>• Progress Trend: Improving</p>
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">Historical Comparison</h3>
              <div className="text-sm text-green-700">
                <p>• Average Session Improvement: +23%</p>
                <p>• Consistency Score: High</p>
                <p>• Treatment Efficacy: Positive</p>
              </div>
            </div>
          </div>
        </div>

        {/* Treatment Recommendations */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Treatment Recommendations</h2>
          <div className="space-y-4">
            <div className="p-4 border-l-4 border-green-500 bg-green-50 rounded">
              <h3 className="font-medium text-green-900 mb-1">Next Session</h3>
              <p className="text-sm text-green-700">Increase difficulty to Medium level based on consistent progress</p>
            </div>
            <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded">
              <h3 className="font-medium text-blue-900 mb-1">Focus Areas</h3>
              <p className="text-sm text-blue-700">Continue exposure to Takeoff scenarios, add turbulence variations</p>
            </div>
            <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded">
              <h3 className="font-medium text-yellow-900 mb-1">Monitoring</h3>
              <p className="text-sm text-yellow-700">Watch for stress spikes during landing sequences</p>
            </div>
          </div>
        </div>

        {/* Behavioral Profile */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Behavioral Profile</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Response Type</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Fast Responder</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Recovery Pattern</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Quick Recovery</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Stress Tolerance</span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Moderate</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Motivation Level</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">High</span>
            </div>
          </div>
        </div>

        {/* System Confidence */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Confidence</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Recommendation Accuracy</span>
                <span className="text-sm text-gray-900">92%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Data Quality</span>
                <span className="text-sm text-gray-900">88%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Model Reliability</span>
                <span className="text-sm text-gray-900">95%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '95%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Button */}
      <div className="text-center mt-8">
        <button
          onClick={() => setShowProgressionCard(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
        >
          Test Progression Modal
        </button>
      </div>
    </div>
  );
};

export default AIInsights;
