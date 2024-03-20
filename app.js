import 'dotenv/config';

import express from 'express';
import expressLayout from 'express-ejs-layouts';
import passport from 'passport';
import session from 'express-session';

// import routes
import mainRoutes from './server/routes/main.js';
import userRoutes from './server/routes/user.js';
import blogRoutes from './server/routes/blog.js';

// express
const app = express();
const PORT = 3000 || process.env.PORT;

// static
app.use(express.static('public'));

// middleware for templating
app.use(expressLayout);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');

// Passport.js and session middleware
app.use(session({ 
    secret: process.env.SESSION_SECRET, 
    resave: false, 
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
 }));

app.use(passport.initialize());
app.use(passport.session());

// middleware to set loggedIn variable
app.use((req, res, next) => {
    res.locals.loggedIn = req.user ? true : false;
    next();
});


app.use('/', mainRoutes);
app.use('/user', userRoutes);
app.use('/blog', blogRoutes);

// app listener
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`)
});