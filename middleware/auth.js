function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }
    res.redirect('/');
}

function ensureRole(role) {
    return (req, res, next) => {
        if (req.user && req.user.role === role) {
            return next();
        }
        res.redirect('/');
    };
}

module.exports = { ensureAuthenticated, ensureRole };
