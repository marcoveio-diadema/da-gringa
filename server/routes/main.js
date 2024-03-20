import express from 'express';
const router = express.Router();

// import db
import db from '../config/db.js';

// GET - home page
router.get('/', async (req, res) => {
    try {
        // Fetch posts from the database
        const result = await db.query(`
            SELECT post.*, categories.category AS category_name, users.username AS author_username 
            FROM post
            INNER JOIN categories ON post.category = categories.id 
            INNER JOIN users ON post.author = users.id 
            ORDER BY post.created_at DESC
        `);

        const posts = result.rows;

        // locals and render the home page
        const locals = {
            title: 'Página Inicial',
            description: "Tudo sobre como se virar na gringa!"
        }

        res.render('main/index.ejs', { 
            locals,
            user: req.user,
            posts,
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'An error occurred while fetching the posts' });
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
     });
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

export default router;