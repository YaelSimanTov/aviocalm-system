const io = require('socket.io-client');

// Connect to your local Node.js server
const socket = io('http://localhost:5000');

socket.on('connect', () => {
    console.log('⌚ Virtual Watch Connected! Sending vitals in 2 seconds...');

    setTimeout(() => {
        // Fake data from a Samsung Watch
        const fakeSensorData = {
            heartRate: 118,
            stressScore: 75,
            spo2: 98
        };

        // Emit the event to the server
        socket.emit('watch_vitals_update', fakeSensorData);
        console.log('📡 Data sent to server:', fakeSensorData);

        // Disconnect after sending
        setTimeout(() => {
            socket.disconnect();
            process.exit(0);
        }, 1000);
    }, 2000);
});