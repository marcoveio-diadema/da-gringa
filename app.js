import 'dotenv/config';

import express from 'express';
import expressLayout from 'express-ejs-layouts';
import passport from 'passport';
import session from 'express-session';
import flash from 'express-flash';

// import routes
import mainRoutes from './server/routes/main.js';
import userRoutes from './server/routes/user.js';
import blogRoutes from './server/routes/blog.js';
import adminRoutes from './server/routes/admin.js';

// express
const app = express();
const PORT = 3000 || process.env.PORT;

// static
app.use(express.static('public'));

// flash messages
app.use(flash());

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
    res.locals.user = req.user ? req.user : null;
    next();
});

// routes
app.use('/', mainRoutes);
app.use('/user', userRoutes);
app.use('/blog', blogRoutes);
app.use('/admin', adminRoutes);


// 500 route
app.use((err, req, res, next) => {
     // locals and render the home page
     const locals = {
        title: 'Erro nos Servidores',
        description: "Tudo sobre como se virar na gringa!"
    }

    console.error(err.stack);
    res.status(500).render('500.ejs', { 
        message: 'Algo deu errado com os nossos servidores.',
        locals,
    });
});

// 404 route
app.use((req, res) => {
    // locals and render the home page
    const locals = {
        title: 'Página não encontrada',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.status(404).render('404.ejs', { 
        message: 'Página não encontrada.',
        locals,
    });
});

// app listener
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`)
});