const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server);

require('dotenv').config();
require('./passportConfig');

var loginRouter = require('./routes/login');
var usersRouter = require('./routes/users');
const registerRouter = require('./routes/register');
const adminRouter = require('./routes/admin');
const organizerRouter = require('./routes/organizer');
const userRouter = require('./routes/user');
const dashboardRouter = require('./routes/dashboard');
const messagesRouter = require("./routes/messages");

var app = express();


io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('chatMessage', (msg) => {
    io.to(msg.room).emit('message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // true if using HTTPS
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


app.use('/', loginRouter);
app.use('/users', usersRouter);
app.use('/register', registerRouter);
app.use('/admin', adminRouter);
app.use('/organizer', organizerRouter);
app.use('/user', userRouter);
app.use('/dashboard', dashboardRouter);
app.use('/inbox', messagesRouter);

app.use((req, res, next) => {
  next(createError(404)); // Create a 404 error for non-existing routes
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error'); // Render error view
});

module.exports = app;
