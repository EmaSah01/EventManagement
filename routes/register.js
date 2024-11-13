// routes/register.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

router.get('/', (req, res) => {
    res.render('register');
});

router.post('/', async (req, res) => {
    const { username, password, confirmPassword, email, role } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (userResult.rows.length > 0) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query('INSERT INTO users (username, password, email, role, status) VALUES ($1, $2, $3, $4, $5)', [username, hashedPassword, email, role, 'active']);

        res.json({ message: 'Registration successful', redirectUrl: '/' });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
