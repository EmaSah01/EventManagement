const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const messagesRouter = require('./messages');

const { ensureAuthenticated, ensureRole } = require('../middleware/auth');

router.use('/inbox', messagesRouter);

router.use(ensureAuthenticated);
router.use(ensureRole('admin'));

router.get('/', ensureAuthenticated, (req, res) => {
    if (req.session.user.role === 'admin') {
        res.render('admin', { user: req.session.user.username });
    } else {
        req.flash('error', 'Unauthorized');
        res.redirect('/');
    }
});


router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        const users = result.rows.map(user => {
            const blockEndDate = new Date(user.block_end_date);
            const now = new Date();
            let statusMessage = 'Active';

            if (user.is_blocked) {
                const timeRemaining = Math.max(0, blockEndDate - now);
                const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
                statusMessage = `Blocked - ${daysRemaining} days left`;
            }

            return {
                ...user,
                statusMessage,
            };
        });

        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).json({ message: 'Error fetching users' });
    }
});



router.post('/add-user', async (req, res) => {
    const { username, password, email, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await pool.query('INSERT INTO users (username, password, email, role, status) VALUES ($1, $2, $3, $4, $5)', [username, hashedPassword, email, role, 'active']);
        res.json({ message: 'User added successfully' });
    } catch (err) {
        console.error('Error adding user:', err.message);
        res.status(500).json({ message: 'Error adding user' });
    }
});

router.post('/block-user/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('UPDATE users SET is_blocked = TRUE, block_start_date = NOW(), block_end_date = NOW() + INTERVAL \'15 days\' WHERE id = $1', [id]);
        res.json({ message: 'User blocked successfully' });
    } catch (err) {
        console.error('Error blocking user:', err.message);
        res.status(500).json({ message: 'Error blocking user' });
    }
});

router.delete('/delete-user/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err.message);
        res.status(500).json({ message: 'Error deleting user' });
    }
});


router.get('/stats', async (req, res) => {
    try {
        // Fetch basic statistics
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const organizerCount = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['organizer']);
        const eventCount = await pool.query('SELECT COUNT(*) FROM events');
        const registrationCount = await pool.query('SELECT COUNT(*) FROM registrations');

        const eventsPerMonthResult = await pool.query(`
            SELECT
                TO_CHAR(date_trunc('month', date), 'Month') AS month,
                COUNT(*) AS event_count
            FROM events
            GROUP BY date_trunc('month', date)
            ORDER BY date_trunc('month', date)
        `);

        const months = eventsPerMonthResult.rows.map(row => row.month.trim());
        const eventCounts = eventsPerMonthResult.rows.map(row => parseInt(row.event_count));

        // Fetch user vs organizer statistics
        const userVsOrganizerResult = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
                (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS organizers
        `);
        const { users, organizers } = userVsOrganizerResult.rows[0];

        const topRatedEventsResult = await pool.query(`
            SELECT
                e.name AS event_name,
                ROUND(AVG(r.rating), 2) AS avg_rating
            FROM reviews r
            JOIN events e ON r.event_id = e.id
            GROUP BY e.name
            ORDER BY avg_rating DESC
            LIMIT 5
        `);
        const topRatedEvents = {
            names: topRatedEventsResult.rows.map(row => row.event_name),
            ratings: topRatedEventsResult.rows.map(row => parseFloat(row.avg_rating))
        };

        const topRegisteredEventsResult = await pool.query(`
            SELECT
                e.name AS event_name,
                COUNT(r.id) AS registration_count
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            GROUP BY e.name
            ORDER BY registration_count DESC
            LIMIT 5
        `);
        const topRegisteredEvents = {
            names: topRegisteredEventsResult.rows.map(row => row.event_name),
            counts: topRegisteredEventsResult.rows.map(row => parseInt(row.registration_count))
        };

        res.json({
            totalUsers: userCount.rows[0].count,
            totalOrganizers: organizerCount.rows[0].count,
            totalEvents: eventCount.rows[0].count,
            totalRegistrations: registrationCount.rows[0].count,
            eventsPerMonth: {
                months,
                eventCounts
            },
            userVsOrganizer: {
                users,
                organizers
            },
            topRatedEvents,
            topRegisteredEvents
        });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});



router.get('/lookup-data', async (req, res) => {
    try {
        const categories = await pool.query('SELECT * FROM categories');
        const locations = await pool.query('SELECT * FROM locations');
        res.json({ categories: categories.rows, locations: locations.rows });
    } catch (err) {
        console.error('Error fetching lookup data:', err.message);
        res.status(500).json({ message: 'Error fetching lookup data' });
    }
});

router.post('/lookup-data', async (req, res) => {
    const { type, name } = req.body;
    try {
        if (type === 'category') {
            await pool.query('INSERT INTO categories (name) VALUES ($1)', [name]);
        } else if (type === 'location') {
            await pool.query('INSERT INTO locations (name) VALUES ($1)', [name]);
        }
        res.json({ message: 'Lookup data added successfully' });
    } catch (err) {
        console.error('Error adding lookup data:', err.message);
        res.status(500).json({ message: 'Error adding lookup data' });
    }
});

router.put('/lookup-data/:id', async (req, res) => {
    const { id } = req.params;
    const { type, name } = req.body;
    try {
        if (type === 'category') {
            await pool.query('UPDATE categories SET name = $1 WHERE id = $2', [name, id]);
        } else if (type === 'location') {
            await pool.query('UPDATE locations SET name = $1 WHERE id = $2', [name, id]);
        }
        res.json({ message: 'Lookup data updated successfully' });
    } catch (err) {
        console.error('Error updating lookup data:', err.message);
        res.status(500).json({ message: 'Error updating lookup data' });
    }
});

router.delete('/lookup-data/:id', async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    try {
        if (type === 'category') {
            await pool.query('DELETE FROM categories WHERE id = $1', [id]);
        } else if (type === 'location') {
            await pool.query('DELETE FROM locations WHERE id = $1', [id]);
        }
        res.json({ message: 'Lookup data deleted successfully' });
    } catch (err) {
        console.error('Error deleting lookup data:', err.message);
        res.status(500).json({ message: 'Error deleting lookup data' });
    }
});

router.get('/events', async (req, res) => {
    try {
        const events = await pool.query(`
            SELECT
                e.id AS id,
                e.name AS name,
                e.date AS date,
                e.time AS time,
                l.name AS location
            FROM events e
            JOIN locations l ON e.location_id = l.id
        `);
        res.json(events.rows);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/registrations/recent', async (req, res) => {
    try {
        const recentRegistrations = await pool.query(`
            SELECT
                r.id AS registration_id,
                u.username AS user_name,
                e.name AS event_name,
                r.registration_date
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.registration_date > NOW() - INTERVAL '1 YEAR'
        `);
        res.json(recentRegistrations.rows);
    } catch (error) {
        console.error('Error fetching recent registrations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.get('/reviews', async (req, res) => {
    try {
        const bestReviews = await pool.query(`
            SELECT r.id, u.username AS user_name, e.name AS event_name, r.rating, r.comment AS review
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.rating = 5
        `);

        const worstReviews = await pool.query(`
            SELECT r.id, u.username AS user_name, e.name AS event_name, r.rating, r.comment AS review
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.rating = 1
        `);

        res.json({
            bestReviews: bestReviews.rows,
            worstReviews: worstReviews.rows
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/admin/logout', (req, res) => {
    req.logout(); // This is a Passport.js method to log out the user
    req.session.destroy(err => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).send('Error logging out');
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/'); // Redirect to the login page
    });
});


module.exports = router;
