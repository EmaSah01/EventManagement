const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const messagesRouter = require('./messages');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');
const multer = require("multer");

router.use(ensureAuthenticated); // Protect all routes in this file
router.use(ensureRole('organizer')); // Ensure user is an organizer

router.use('/inbox', messagesRouter);
const getLocationsAndCategories = async () => {
    const locations = await pool.query('SELECT * FROM locations');
    const categories = await pool.query('SELECT * FROM categories');
    return { locations: locations.rows, categories: categories.rows };
};

async function getRegistrationsForOrganizer(organizerId) {
    try {
        const query = `
            SELECT 
                registrations.id, 
                users.username, 
                events.name AS event_name,
                registrations.registration_date,
                registrations.status
            FROM 
                registrations
            INNER JOIN 
                events ON registrations.event_id = events.id
            INNER JOIN 
                users ON registrations.user_id = users.id
            WHERE 
                events.organizer_id = $1
            ORDER BY 
                registrations.registration_date DESC;
        `;

        const result = await pool.query(query, [organizerId]);
        return result.rows;
    } catch (err) {
        console.error('Error fetching registrations for organizer:', err);
        throw err;
    }
}

async function getNotificationsForOrganizer(organizerId) {
    try {
        const query = `
            SELECT 
                notifications.id, 
                users.username AS user_name, 
                events.name AS event_name, 
                notifications.is_read, 
                notifications.created_at,
                CONCAT(users.username, ' has registered for your event ', events.name) AS message
            FROM 
                notifications
            INNER JOIN 
                users ON notifications.user_id = users.id
            INNER JOIN 
                events ON notifications.event_id = events.id
            WHERE 
                notifications.organizer_id = $1
            ORDER BY 
                notifications.created_at DESC;
        `;

        const result = await pool.query(query, [organizerId]);
        console.log('Fetched notifications:', result.rows);
        return result.rows;
    } catch (err) {
        console.error('Error fetching notifications for organizer:', err);
        throw err;
    }
}



router.get('/', async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(403).send('Forbidden');
        }
        const activeEventsQuery = `
            SELECT 
                e.id, e.name, e.date, e.time, e.description, e.ticket_price, e.status,
                l.name AS location_name, 
                c.name AS category_name
            FROM events e
            JOIN locations l ON e.location_id = l.id
            JOIN categories c ON e.category_id = c.id
            WHERE e.organizer_id = $1 AND e.date >= CURRENT_DATE
        `;
        const activeEventsResult = await pool.query(activeEventsQuery, [req.user.id]);

        const pastEventsQuery = `
            SELECT 
                e.id, e.name, e.date, e.time, e.description, e.ticket_price, e.status,
                l.name AS location_name, 
                c.name AS category_name
            FROM events e
            JOIN locations l ON e.location_id = l.id
            JOIN categories c ON e.category_id = c.id
            WHERE e.organizer_id = $1 AND e.date < CURRENT_DATE
        `;
        const pastEventsResult = await pool.query(pastEventsQuery, [req.user.id]);


        const { locations, categories } = await getLocationsAndCategories();

        const registrations = await getRegistrationsForOrganizer(req.user.id);

        const reviewsQuery = `
            SELECT 
                reviews.id, 
                users.username, 
                events.name AS event_name, 
                reviews.rating, 
                reviews.comment
            FROM 
                reviews
            INNER JOIN 
                events ON reviews.event_id = events.id
            INNER JOIN 
                users ON reviews.user_id = users.id
            WHERE 
                events.organizer_id = $1
            ORDER BY 
                reviews.id DESC;
        `;
        const reviewsResult = await pool.query(reviewsQuery, [req.user.id]);

        const notifications = await getNotificationsForOrganizer(req.user.id);


        res.render('organizer', {
            user: req.session.user.username,
            activeEvents: activeEventsResult.rows,
            pastEvents: pastEventsResult.rows,
            locations,
            categories,
            registrations,
            reviews: reviewsResult.rows,
            notifications
        });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/notifications', async (req, res) => {
    try {
        const notifications = await getNotificationsForOrganizer(req.user.id);
        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.post('/events', async (req, res) => {
    const { name, date, time, location_id, description, category_id, ticket_price } = req.body;

    const today = new Date();
    const eventDateTime = new Date(`${date}T${time}`);

    if (eventDateTime < today) {
        return res.status(400).send('Invalid date and time.');
    }

    try {
        await pool.query(
            `INSERT INTO events (name, date, time, location_id, description, category_id, ticket_price, organizer_id, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')`,
            [name, date, time, location_id, description, category_id, ticket_price, req.user.id]
        );
        res.redirect('/organizer'); // Redirect to the organizer dashboard
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});



router.put('/events/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE events 
             SET status = $1
             WHERE id = $2 AND organizer_id = $3 RETURNING *`,
            [status, id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found or not authorized' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/edit/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch event details by ID
        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1 AND organizer_id = $2', [id, req.user.id]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found or not authorized' });
        }

        // Fetch locations and categories to populate the dropdowns
        const { locations, categories } = await getLocationsAndCategories();

        // Render the edit page with event details
        res.render('edit_event', {
            event: eventResult.rows[0],
            locations,
            categories,
        });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { name, date, time, location_id, description, category_id, ticket_price } = req.body;
    try {
        const result = await pool.query(
            `UPDATE events 
             SET name = $1, date = $2, time = $3, location_id = $4, description = $5, category_id = $6, ticket_price = $7
             WHERE id = $8 AND organizer_id = $9 RETURNING *`,
            [name, date, time, location_id, description, category_id, ticket_price, id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found or not authorized' });
        }

        res.redirect('/organizer');
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/registrations/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Očekuje se da status bude 'approved' ili 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const result = await pool.query(
            `UPDATE registrations 
             SET status = $1
             WHERE id = $2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        await pool.query(
            `INSERT INTO registration_status (registration_id, changed_by, old_status, new_status)
            VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, result.rows[0].status, status]
        );
        console.log('Updated Registration:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});
const upload = multer({ storage });

router.get('/settings', async (req, res) => {
    try {
        // Preuzmi podatke o korisniku
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];

        // Proveri da li profilna slika postoji
        const profileImage = user.profile_image ? `/uploads/${user.profile_image}` : null;

        const messages = {
            success: req.flash('success'),
            error: req.flash('error')
        };
        res.render('settings', {
            user,
            profileImage,
            profileImageExists: !!profileImage,
            messages
        });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).send('Server Error');
    }
});
router.post('/settings/update-profile-image', upload.single('profileImage'), async (req, res) => {
    const profileImage = req.file ? req.file.filename : null;
    const userId = req.user.id;

    try {
        await pool.query(
            'UPDATE users SET profile_image = $1 WHERE id = $2',
            [profileImage, userId]
        );

        res.redirect('/organizer/settings');
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/settings/update-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];


        if (newPassword) {
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                req.flash('error', 'Current password is incorrect');
                return res.redirect('/organizer/settings');
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await pool.query(
                'UPDATE users SET password = $1 WHERE id = $2',
                [hashedPassword, userId]
            );
            req.flash('success', 'Password changed successfully');
        }

        res.redirect('/organizer/settings');
    } catch (err) {
        console.error('Server error:', err.message);
        req.flash('error', 'Server error');
        res.redirect('/organizer/settings');
    }
});

router.post('/organizer/logout', (req, res) => {
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
