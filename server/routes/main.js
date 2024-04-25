import express from 'express';
import bodyParser from 'body-parser';
import sanitizeHtml from 'sanitize-html';
import moment from 'moment';
const router = express.Router();

// Body parser
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.static("public"));

// import db
import db from '../config/db.js';

// import functions
import config from '../helpers/functions.js';
import sanitize from 'sanitize-html';
const { sendContactEmail } = config;

// GET - home page
router.get('/', async (req, res) => {
    try {
        // fetch categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const categories = categoriesResult.rows;
        
        // Fetch posts from the database
        const blogResult = await db.query(`
            SELECT posts.*, categories.category AS category_name, users.username AS author_username 
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id 
            INNER JOIN users ON posts.author_id = users.id 
            ORDER BY COALESCE(posts.updated_at, posts.created_at) DESC
        `);

        const posts = blogResult.rows;

        // fetch all discussions from db
        const forumResult = await db.query(`
            SELECT forum_discussions.id, forum_discussions.title, forum_discussions.content, forum_discussions.user_id, forum_discussions.country, forum_discussions.slug, forum_discussions.created_at, users.username AS author_username, users.profile_img AS author_img, ARRAY_AGG(tags.tag) AS tag_names
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            LEFT JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            GROUP BY forum_discussions.id, users.username, users.profile_img
            ORDER BY forum_discussions.created_at DESC
        `);

        // Get the discussions
        const discussions = forumResult.rows;

        // Fetch the top 10 most frequently used tags
        const hotTagsResult = await db.query(`
            SELECT tags.tag AS tag_name, COUNT(*) as count
            FROM forum_discussion_tags
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            LEFT JOIN forum_discussions ON forum_discussions.id = forum_discussion_tags.discussion_id
            GROUP BY tags.tag
            ORDER BY count DESC
            LIMIT 10
        `);
        const hotTags = hotTagsResult.rows.map(row => row.tag_name);

        // countries from db
        const countriesResult = await db.query(`
            SELECT country, COUNT(*) as count
            FROM forum_discussions
            GROUP BY country
            ORDER BY count DESC
            LIMIT 5
        `);

        const countries = countriesResult.rows.map(row => row.country);

        // locals and render the home page
        const locals = {
            title: 'Página Inicial',
            description: "Tudo sobre como se virar na gringa!"
        }

        res.render('main/index.ejs', { 
            locals,
            user: req.user,
            posts,
            categories,
            req: req,
            hotTags,
            discussions,
            countries
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu ao tentarmos carregar os posts.' });
    }
});

// GET - contact page
router.get('/contact', (req, res) => {
    const locals = {
        title: 'Contato',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('main/contact.ejs', { 
        locals,
        user: req.user,
        formData: req.flash('formData')[0] 
     });
});

// POST - contact form submission
router.post('/contact', async (req, res) => {
    try {
        const name = sanitizeHtml(req.body.name);
        const email = sanitizeHtml(req.body.email);
        const phone = req.body.phone ? sanitizeHtml(req.body.phone) : null;
        const message = sanitizeHtml(req.body.message);

         // Validate form inputs
        if (!name || !email || !message){
            req.flash('error', 'Todos os campos marcados com * são obrigatórios.');
            req.flash('formData', { name, email, phone, message });
            return res.redirect('/contact');
        }

        // Send an email to the admin
        await sendContactEmail(name, email, phone, message);

        // message to display
        const locals = {
            title: 'Contato',
            description: "Tudo sobre como se virar na gringa!"
        }

        // Redirect to the contact page with a success message
        req.flash('success', 'Mensagem enviada com sucesso!');
        res.redirect('/contact');
    } catch (error) {
        // message to display
        const locals = {
            title: 'Contato',
            description: "Tudo sobre como se virar na gringa!"
        }
        console.error('Error submitting contact form:', error);
        // Render the contact page with an error message
        req.flash('error', 'Ocorreu um erro ao enviar o formulário de contato, Tente novamente');
        res.redirect('/contact');
    };
});


// GET - about page
router.get('/about', (req, res) => {
    const locals = {
        title: 'Sobre Nós',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('main/about.ejs', { 
        locals,
        user: req.user,
     });
});

// GET - Search page
router.get('/search', async (req, res) => {
    try {
        // Fetch the search term from the query parameters
        const searchTerm = req.query.q;

        // Fetch posts from the posts table
        const postsResult = await db.query(`
            SELECT posts.*, categories.category AS category_name, users.username AS author_username 
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id 
            INNER JOIN users ON posts.author_id = users.id 
            WHERE posts.content ILIKE $1 OR posts.title ILIKE $1 OR posts.intro ILIKE $1
            ORDER BY COALESCE(posts.updated_at, posts.created_at) DESC
        `, [`%${searchTerm}%`]);

        const posts = postsResult.rows;

        // Fetch discussions from the forum_discussions table
        const discussionsResult = await db.query(`
            SELECT forum_discussions.*, users.username AS author_username, users.profile_img AS author_img 
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            WHERE forum_discussions.content ILIKE $1 OR forum_discussions.title ILIKE $1 OR forum_discussions.country ILIKE $1
            ORDER BY forum_discussions.created_at DESC
        `, [`%${searchTerm}%`]);

        const discussions = discussionsResult.rows;

        // Fetch the top 10 most frequently used tags
        const hotTagsResult = await db.query(`
            SELECT tags.tag AS tag_name, COUNT(*) as count
            FROM forum_discussion_tags
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            LEFT JOIN forum_discussions ON forum_discussions.id = forum_discussion_tags.discussion_id
            GROUP BY tags.tag
            ORDER BY count DESC
            LIMIT 10
        `);
        const hotTags = hotTagsResult.rows.map(row => row.tag_name);

        // countries from db
        const countriesResult = await db.query(`
            SELECT country, COUNT(*) as count
            FROM forum_discussions
            GROUP BY country
            ORDER BY count DESC
            LIMIT 5
        `);

        const countries = countriesResult.rows.map(row => row.country);

        // Fetch all categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const categories = categoriesResult.rows;

        const locals = {
            title: 'Busca no blog e fórum',
            description: "Search results"
        }

        res.render('main/search.ejs', { 
            locals,
            user: req.user,
            posts,
            discussions,
            categories,
            searchTerm,
            req: req,
            hotTags,
            countries
        });
    } catch (error) {
        console.error('Error fetching posts and discussions:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'An error occurred while fetching the posts and discussions' });
    }
});


export default router;