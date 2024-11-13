require('dotenv').config(); // Ovo mora biti na početku vašeg fajla

const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: 100,
    idleTimeoutMillis: 3000
});

const socketIo = require('socket.io');
const io = socketIo(); // Replace with your actual initialization

// Handle incoming chat messages
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('chatMessage', async (msg) => {
        try {
            await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)',
                [msg.senderId, msg.receiverId, msg.content]
            );
            io.to(msg.room).emit('message', msg);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

module.exports = pool;