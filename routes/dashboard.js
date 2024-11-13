const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, (req, res) => {
    // Example data you might want to pass to the view
    const user = req.user.username; // Assuming req.user contains the logged-in user's info

    res.render('dashboard', { user });
});

module.exports = router;
