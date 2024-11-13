const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
const pool = require('../db');

router.use(session({
    secret: process.env.SESSION_SECRET, // Use a secure random string from .env
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Use HTTPS in production
}));

router.use(flash());

router.get('/', (req, res) => {
    console.log('Rendering login page');
    res.render('login');
});

router.post('/login', (req, res, next) => {
    const { username, password } = req.body;

    console.log('Login attempt with username:', username);

    pool.query('SELECT * FROM users WHERE username = $1', [username], (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (result.rows.length === 0) {
            console.log('No user found with username:', username);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];
        console.log('User found:', user);

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            if (!isMatch) {
                console.log('Password does not match for username:', username);
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            console.log('Password match for username:', username);
            req.session.user = user; // Store user info in session

            console.log('Session data:', req.session);

            req.session.save(() => { // Ensure session is saved before redirect
                console.log('Redirecting user with role:', user.role);
                res.json({ redirectUrl: `/${user.role}` }); // Send redirection URL in JSON
            });
        });
    });
});



module.exports = router;
