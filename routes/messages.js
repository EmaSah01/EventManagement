const express = require('express');
const router = express.Router();
const pool = require('../db'); // Adjust path as needed

router.get('/', async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Fetch sent messages with receiver usernames
        const sentMessagesQuery = `
            SELECT m.id, m.receiver_id, r.username AS receiver_username, m.content, m.sent_at
            FROM messages m
            JOIN users r ON m.receiver_id = r.id
            WHERE m.sender_id = $1
            ORDER BY m.sent_at DESC
        `;
        const { rows: sentMessages } = await pool.query(sentMessagesQuery, [userId]);

        // Fetch received messages with sender usernames
        const receivedMessagesQuery = `
            SELECT m.id, m.sender_id, s.username AS sender_username, m.content, m.sent_at
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            WHERE m.receiver_id = $1
            ORDER BY m.sent_at DESC
        `;
        const { rows: receivedMessages } = await pool.query(receivedMessagesQuery, [userId]);

        const usersQuery = `
            SELECT id, username FROM users WHERE id != $1
        `;
        const { rows: users } = await pool.query(usersQuery, [userId]);

        res.render('inbox', {
            userId,
            sentMessages,
            receivedMessages,
            users
        });
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/send', async (req, res) => {
    const { senderId, receiverId, content } = req.body;

    try {
        await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)',
            [senderId, receiverId, content]
        );
        res.redirect('/inbox'); // Redirect to inbox or a success page
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
