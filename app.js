import 'dotenv/config';

import express from 'express';
import expressLayout from 'express-ejs-layouts';
import passport from 'passport';
import session from 'express-session';
import flash from 'express-flash';
import moment from 'moment';
import connectPgSimple from 'connect-pg-simple';
import db from './server/config/db.js';
import { SitemapStream, streamToPromise } from 'sitemap';
import { createGzip } from 'zlib';
import cookieParser from 'cookie-parser';

// import routes
import mainRoutes from './server/routes/main.js';
import userRoutes from './server/routes/user.js';
import blogRoutes from './server/routes/blog.js';
import adminRoutes from './server/routes/admin.js';
import forumRoutes from './server/routes/forum.js';

// express 
const app = express();
const PORT = process.env.PORT;

// static
app.use(express.static('public'));

// moment.js middleware
app.use((req, res, next) => {
    res.locals.moment = moment;
    next();
  });

// middleware for templating
app.use(expressLayout);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');

// PG session
const pgSession = connectPgSimple(session);

// Passport.js and session middleware
app.use(session({
    store: new pgSession({
        conString: process.env.NODE_ENV === 'production' ? process.env.DB_STRING : 
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}?sslmode=disable`
    }),
    secret: process.env.SESSION_SECRET, 
    resave: false, 
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 * 30 // 30 days
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

// flash messages
app.use(flash());

// Use cookie-parser
app.use(cookieParser());

// routes
app.use('/', mainRoutes);
app.use('/user', userRoutes);
app.use('/blog', blogRoutes);
app.use('/admin', adminRoutes);
app.use('/forum', forumRoutes);

// robots.txt
app.get('/robots.txt', function (req, res) {
    res.type('text/plain');
    const hostname = process.env.NODE_ENV === 'production' ? process.env.HOSTNAME_PROD : process.env.HOSTNAME_DEV;
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${hostname}sitemap.xml`);
});

// sitemap
let sitemap

app.get('/sitemap.xml', async function(req, res) {
  res.header('Content-Type', 'application/xml');
  res.header('Content-Encoding', 'gzip');
  // if we have a cached entry send it
  if (sitemap) {
    res.send(sitemap)
    return
  }

  try {
    const hostname = process.env.NODE_ENV === 'production' ? process.env.HOSTNAME_PROD : process.env.HOSTNAME_DEV;
    const smStream = new SitemapStream({ hostname })
    const pipeline = smStream.pipe(createGzip())

    // pipe your entries or directly write them.
    smStream.write({ url: '/',  changefreq: 'daily', priority: 0.9 })
    smStream.write({ url: '/contact/',  changefreq: 'monthly',  priority: 0.7 })
    smStream.write({ url: '/about/', changefreq: 'monthly', priority: 0.5})

    // Fetch posts from the database
    const result = await db.query(`
        SELECT posts.*, categories.category AS category_name, users.username AS author_username 
        FROM posts
        INNER JOIN categories ON posts.category_id = categories.id 
        INNER JOIN users ON posts.author_id = users.id 
        ORDER BY COALESCE(posts.updated_at, posts.created_at) DESC
    `);

    const posts = result.rows;

    // Add each post to the sitemap
    posts.forEach(post => {
      smStream.write({ url: `/post/${post.slug.trim()}/`, changefreq: 'weekly', priority: 0.8 })
    });

    // cache the response
    streamToPromise(pipeline).then(sm => sitemap = sm)
    // make sure to attach a write stream such as streamToPromise before ending
    smStream.end()
    // stream write the response
    pipeline.pipe(res).on('error', (e) => {throw e})
  } catch (e) {
    console.error(e)
    res.status(500).end()
  }
})

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