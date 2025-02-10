const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const { PeerServer } = require('peer');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const MAIN_ROOM = 'main-room'; // Single fixed room

app.use(cors());
app.use(express.static('public'));

// Create a PeerServer for handling WebRTC connections
const peerServer = PeerServer({ 
    port: 9000,
    path: '/peerjs',
    proxied: true,
    ssl: true,
    allow_discovery: true
});

// Store participants and their usernames
const participants = new Map(); // Map<userId, username>

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user joining (only one room)
    socket.on('join-main-room', (userData) => {
        const { userId, username } = userData;
        socket.join(MAIN_ROOM);
        participants.set(userId, username);

        // Notify others in the room
        socket.to(MAIN_ROOM).emit('user-connected', { userId, username });
        
        // Send list of existing users to the new participant
        const existingUsers = Array.from(participants.entries())
            .filter(([id]) => id !== userId)
            .map(([id, name]) => ({ userId: id, username: name }));
        socket.emit('existing-users', existingUsers);

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            participants.delete(userId);
            socket.to(MAIN_ROOM).emit('user-disconnected', userId);
        });

        // Handle chat messages
        socket.on('message', (message) => {
            io.to(MAIN_ROOM).emit('message', {
                userId: userId,
                username: participants.get(userId),
                message: message,
                timestamp: new Date().toISOString()
            });
        });

        // Handle stream forwarding (SFU functionality)
        socket.on('stream-ready', (streamId) => {
            socket.to(MAIN_ROOM).emit('new-stream-available', {
                userId: userId,
                username: participants.get(userId),
                streamId: streamId
            });
        });

        // Handle microphone state changes
        socket.on('mic-state-changed', (data) => {
            socket.to(MAIN_ROOM).emit('user-mic-state', data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`PeerJS server is running on port 9000`);
}); 