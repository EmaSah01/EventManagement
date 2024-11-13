const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const pool = require('./db');
const {use, deserializeUser, serializeUser} = require("passport");

use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            const user = result.rows[0];
            if (user && await bcrypt.compare(password, user.password)) {
                return done(null, user);
            }
            return done(null, false, { message: 'Invalid credentials' });
        } catch (err) {
            return done(err);
        }
    }
));

serializeUser((user, done) => {
    done(null, user.id);
});

deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (err) {
        done(err);
    }
});
