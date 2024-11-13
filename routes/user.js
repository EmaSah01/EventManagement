const express = require('express');
const router = express.Router();
const pool = require('../db');
const messagesRouter = require('./messages');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');


router.use('/inbox', messagesRouter);

router.use(ensureAuthenticated);
router.use(ensureRole('user'));

async function getEventsWithDetails(userId, additionalConditions = '') {
    const query = `
        SELECT e.*, l.name AS location_name, c.name AS category_name
        FROM events e
        JOIN locations l ON e.location_id = l.id
        JOIN categories c ON e.category_id = c.id
        WHERE e.id NOT IN (
            SELECT event_id FROM registrations WHERE user_id = $1
        )
        AND e.id NOT IN (
            SELECT event_id FROM registrations WHERE status = 'canceled'
        )
        ${additionalConditions}
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
}
router.get('/', async (req, res) => {
    try {
        const now = new Date();

        const allEvents = await getEventsWithDetails(req.user.id) || [];

        const activeEvents = allEvents.filter(event => new Date(event.date) >= now);
        const pastEvents = allEvents.filter(event => new Date(event.date) < now);

        const popularEvents = await getPopularEvents() || [];
        const randomEvents = await getRandomEvents() || [];
        const recommendedEvents = await getRecommendedEvents(req.user.id) || [];
        const searchQuery = req.query.searchQuery || '';

        res.render('user', {
            activeEvents,
            pastEvents,
            currentPath: '/',
            searchQuery,
            popularEvents,
            randomEvents,
            recommendedEvents
        });
    } catch (err) {
        console.error('Error fetching events:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

async function getPopularEvents() {
    const now = new Date();
    const query = `
        SELECT e.*, l.name AS location_name, c.name AS category_name, COUNT(r.id) AS registrations_count
        FROM events e
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN categories c ON e.category_id = c.id
        LEFT JOIN registrations r ON e.id = r.event_id
        WHERE e.date >= $1
        AND e.id NOT IN (
            SELECT event_id FROM registrations WHERE status = 'canceled'
        )
        GROUP BY e.id, l.name, c.name
        ORDER BY registrations_count DESC
        LIMIT 2
    `;
    const result = await pool.query(query, [now]);
    return result.rows;
}

async function getRandomEvents() {
    const now = new Date();
    const query = `
        SELECT e.*, l.name AS location_name, c.name AS category_name
        FROM events e
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE e.date >= $1
        AND e.id NOT IN (
            SELECT event_id FROM registrations WHERE status = 'canceled'
        )
        ORDER BY RANDOM()
        LIMIT 2
    `;
    const result = await pool.query(query, [now]);
    return result.rows;
}
async function getRecommendedEvents(userId) {
    const query = `
        SELECT e.*, l.name AS location_name, c.name AS category_name
        FROM events e
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE e.category_id IN (
            SELECT category_id FROM user_interests WHERE user_id = $1
        )
        AND e.date > NOW() -- Ensure the event date is in the future
        AND e.id NOT IN (
            SELECT event_id FROM registrations WHERE status = 'canceled'
        )
        ORDER BY (
            SELECT COUNT(*) FROM registrations WHERE event_id = e.id
        ) DESC
        LIMIT 2
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
}

router.get('/my-events', async (req, res) => {
    try {
        const userId = req.user.id;

        const pastEventsQuery = `
            SELECT e.*, l.name AS location_name, c.name AS category_name, r.registration_date, r.status AS registration_status, rv.rating, rv.comment
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            LEFT JOIN locations l ON e.location_id = l.id
            LEFT JOIN categories c ON e.category_id = c.id
            LEFT JOIN reviews rv ON rv.event_id = e.id AND rv.user_id = r.user_id
            WHERE r.user_id = $1 AND e.date < NOW()
            AND e.id NOT IN (
                SELECT event_id FROM registrations WHERE status = 'canceled'
            )
        `;
        const pastEvents = await pool.query(pastEventsQuery, [userId]);

        const activeQuery = `
            SELECT e.*, l.name AS location_name, c.name AS category_name, r.registration_date, r.status AS registration_status
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            LEFT JOIN locations l ON e.location_id = l.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE r.user_id = $1 AND e.date > NOW()
            AND e.id NOT IN (
                SELECT event_id FROM registrations WHERE status = 'canceled'
            )
        `;
        const activeEvents = await pool.query(activeQuery, [userId]);

        res.render('my-events', {
            pastEvents: pastEvents.rows,
            activeEvents: activeEvents.rows,
            currentPath: '/user/my-events'
        });

    } catch (err) {
        console.error('Error fetching registered events:', err.message);
        res.status(500).json({ message: 'Error fetching registered events', error: err.message });
    }
});


router.post('/cancel-registration/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    try {
        await pool.query('DELETE FROM registrations WHERE event_id = $1 AND user_id = $2 AND status = $3', [eventId, userId, 'pending']);

        res.status(200).send('Registration canceled successfully.');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to cancel registration.');
    }
});

router.post('/search', async (req, res) => {
    const { searchQuery } = req.body;
    const userId = req.user.id; // Assuming user ID is stored in the session

    try {
        const searchQueryText = `
            SELECT e.*, l.name as location_name, c.name as category_name, u.username as organizer_name
            FROM events e
            JOIN locations l ON e.location_id = l.id
            JOIN categories c ON e.category_id = c.id
            JOIN users u ON e.organizer_id = u.id
            WHERE e.name ILIKE $1
            OR l.name ILIKE $1
            OR c.name ILIKE $1
            OR u.username ILIKE $1
            OR e.id IN (
                SELECT event_id
                FROM registrations
                WHERE user_id = $2
            )
        `;
        const values = [`%${searchQuery}%`, userId];
        const result = await pool.query(searchQueryText, values);

        const searchResults = result.rows;

+        res.render('user', {
            randomEvents: searchResults,
            searchQuery: searchQuery,
            currentPath: '/'
        });
    } catch (err) {
        console.error('Error searching for events:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});
router.post('/events/:id/register', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const registrationResult = await pool.query(
            `INSERT INTO registrations (event_id, user_id) 
             VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
            [id, userId]
        );

        if (registrationResult.rows.length > 0) {
            const eventResult = await pool.query(
                `SELECT organizer_id FROM events WHERE id = $1`,
                [id]
            );

            const event = eventResult.rows[0];

            await pool.query(
                `INSERT INTO notifications (organizer_id, event_id, user_id, message) 
                 VALUES ($1, $2, $3, $4)`,
                [event.organizer_id, id, userId, `New registration from user with ID ${userId} for your event.`]
            );

            res.redirect('/user/my-events');
        } else {
            res.status(400).json({ message: 'Already registered for this event.' });
        }
    } catch (err) {
        console.error('Error registering for event:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});



router.post('/events/:eventId/cancel', async (req, res) => {
    const userId = req.user.id; // Assuming user ID is stored in the session
    const eventId = req.params.eventId;

    try {
        await pool.query(
            'UPDATE registrations SET status = $1 WHERE event_id = $2 AND user_id = $3',
            ['cancelled', eventId, userId]
        );

        res.redirect('/user/my-events');
    } catch (err) {
        console.error('Error cancelling registration:', err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/reviews', async (req, res) => {
    const userId = req.user.id;
    const { eventId, rating, comment } = req.body;

    try {
        const existingReview = await pool.query(
            'SELECT * FROM reviews WHERE event_id = $1 AND user_id = $2',
            [eventId, userId]
        );

        if (existingReview.rows.length > 0) {
            // If a review already exists, update it
            await pool.query(
                'UPDATE reviews SET rating = $1, comment = $2 WHERE event_id = $3 AND user_id = $4',
                [rating, comment, eventId, userId]
            );
        } else {
            await pool.query(
                'INSERT INTO reviews (event_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)',
                [eventId, userId, rating, comment]
            );
        }

        res.redirect('/user/my-events');
    } catch (err) {
        console.error('Error submitting review:', err.message); // Detailed error message
        res.status(500).json({ message: 'Error submitting review', error: err.message });
    }
});
router.post('/add-interests', async (req, res) => {
    const { interest } = req.body;
    const userId = req.user.id;

    if (!interest) {
        return res.status(400).send('No interest provided.');
    }

    try {
        const queryText = 'INSERT INTO user_interests (user_id, interest) VALUES ($1, $2)';
        await pool.query(queryText, [userId, interest]);

        res.redirect('/user');
    } catch (error) {
        console.error('Error adding interest:', error);
        res.status(500).send('Server error.');
    }
});


router.get('/recommended-events', async (req, res) => {
    const userId = req.user.id;

    try {
        const interestsResult = await pool.query('SELECT interest FROM user_interests WHERE user_id = $1', [userId]);
        const interests = interestsResult.rows.map(row => row.interest);

        if (interests.length === 0) {
            return res.render('recommended-events', {
                events: [], // No recommended events if no interests
                message: 'No recommended events available. Add some interests to get recommendations.'
            });
        }

        const query = `
            SELECT e.*, l.name AS location_name, c.name AS category_name
            FROM events e
            JOIN locations l ON e.location_id = l.id
            JOIN categories c ON e.category_id = c.id
            WHERE c.name = ANY($1::text[])
        `;
        const result = await pool.query(query, [interests]);

        res.render('recommended-events', {
            events: result.rows
        });
    } catch (err) {
        console.error('Error fetching recommended events:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/popular-events', async (req, res) => {
    try {
        const query = `
            SELECT e.*, COUNT(r.id) AS registration_count
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id
            GROUP BY e.id
            ORDER BY registration_count DESC
            LIMIT 5
        `;
        const result = await pool.query(query);

        res.render('user', {
            popularEvents: result.rows,
            currentPath: '/user'
        });
    } catch (err) {
        console.error('Error fetching popular events:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/random-events', async (req, res) => {
    try {
        const query = `
            SELECT e.*, l.name AS location_name, c.name AS category_name
            FROM events e
            JOIN locations l ON e.location_id = l.id
            JOIN categories c ON e.category_id = c.id
            ORDER BY RANDOM()
            LIMIT 5
        `;
        const result = await pool.query(query);

        res.render('user', {
            randomEvents: result.rows,
            currentPath: '/user'
        });
    } catch (err) {
        console.error('Error fetching random events:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/recommended-events', async (req, res) => {
    const userId = req.user.id;

    try {
        const interestsResult = await pool.query('SELECT interest FROM user_interests WHERE user_id = $1', [userId]);
        const interests = interestsResult.rows.map(row => row.interest);

        if (interests.length > 0) {
            const query = `
                SELECT e.*, l.name AS location_name, c.name AS category_name
                FROM events e
                JOIN locations l ON e.location_id = l.id
                JOIN categories c ON e.category_id = c.id
                WHERE c.name = ANY($1::text[])
            `;
            const result = await pool.query(query, [interests]);

            res.render('user', {
                recommendedEvents: result.rows,
                currentPath: '/user'
            });
        } else {
            res.render('user', {
                recommendedEvents: [],
                currentPath: '/user'
            });
        }
    } catch (err) {
        console.error('Error fetching recommended events:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/add-interests', ensureAuthenticated, async (req, res) => {
    const user_id = req.user.id;

    try {
        const categoryResults = await pool.query('SELECT * FROM categories');
        const interestResults = await pool.query('SELECT interest FROM user_interests WHERE user_id = $1', [user_id]);

        res.render('add-interests', {
            categories: categoryResults.rows,
            interests: interestResults.rows.map(row => row.interest) // Convert to an array of interests
        });
    } catch (error) {
        console.error('Error fetching categories or interests:', error);
        res.status(500).send('Error fetching data');
    }
});

router.post('/user/interests', async (req, res) => {
    const userId = req.user.id;

    console.log('Request body:', req.body);

    const interests = Array.isArray(req.body.interests) ? req.body.interests : (req.body.interests ? [req.body.interests] : []);

    if (!interests || interests.length === 0) {
        console.error('No interests provided');
        return res.status(400).json({ message: 'No interests provided' });
    }

    try {
        const queries = interests.map(interest => {
            return pool.query(
                'INSERT INTO user_interests (user_id, interest) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, interest]
            );
        });

        await Promise.all(queries);
        res.redirect('/user/add-interests');
    } catch (err) {
        console.error('Error updating interests:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});


router.post('/interests/delete', ensureAuthenticated, async (req, res) => {
    const user_id = req.user.id;
    const { interest } = req.body;

    if (!user_id || !interest) {
        return res.status(400).send('Invalid input');
    }

    try {
        await pool.query(
            'DELETE FROM user_interests WHERE user_id = $1 AND interest = $2',
            [user_id, interest]
        );
        res.redirect('/user/add-interests');
    } catch (error) {
        console.error('Error deleting interest:', error);
        res.status(500).send('Error deleting interest');
    }
});

router.post('/user/logout', (req, res) => {
    req.logout();
    req.session.destroy(err => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).send('Error logging out');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});


module.exports = router;
