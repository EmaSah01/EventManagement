const pool = require('./db');
const bcrypt = require('bcryptjs');

const hashPasswords = async () => {
    try {
        const result = await pool.query('SELECT id, username, password FROM users WHERE LENGTH(password) < 60');
        const users = result.rows;

        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);

            await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);

            console.log(`User ${user.username} updated`);
        }

        console.log('Password hashing complete');
    } catch (err) {
        console.error('Error hashing passwords:', err);
    } finally {
        await pool.end(); // Zatvori konekciju sa bazom
    }
};

hashPasswords();