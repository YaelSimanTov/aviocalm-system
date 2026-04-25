const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const authRoutes = require('./routes/auth-routes');
const ownerRoutes = require('./routes/owner-routes');
const patientsRoutes = require('./routes/patients-routes');
const watchRoutes = require('./routes/watch-routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Express + Socket.io
const server = http.createServer(app);

// Socket.io server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Make io available inside routes through req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
    console.log("Socket client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Socket client disconnected:", socket.id);
    });
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/watch", watchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/patients', patientsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'Server running',
            timestamp: new Date().toISOString()
        }
    });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
    console.log(`AvioCalm Backend Server running on port ${PORT}`);
    console.log(`Health check available locally at: http://localhost:${PORT}/api/health`);
    console.log(`Server is also available on your network at: http://YOUR_COMPUTER_IP:${PORT}`);
});