import express from 'express';
const router = express.Router();

// import db
import db from '../config/db.js';

// GET - Post page
router.get('/post/:slug', async (req, res) => {
    try {
        // Get the slug from the URL
        const slug = req.params.slug;

        // Fetch the post from the database
        const result = await db.query(`
            SELECT post.*, categories.category AS category_name, users.username AS author_username 
            FROM post
            INNER JOIN categories ON post.category = categories.id 
            INNER JOIN users ON post.author = users.id 
            WHERE post.slug = $1
        `, [slug]);

        // Check if a post was found
        if (result.rows.length > 0) {
            // Get the post
            const post = result.rows[0];

            // locals and render the post page
            const locals = {
                title: 'Blog',
                description: "Tudo sobre como se virar na gringa!"
            }

            res.render('blog/post.ejs', { 
                locals,
                post,
            });
        } else {
            // No post was found, render a 404 page
            res.status(404).render('404.ejs', { message: 'Post não encontrado.' });
        }
    } catch (error) {
        console.error('Error fetching post:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos achar o post, tente novamente.' });
    }
});

// GET - Category page
router.get('/category', (req, res) => {
    const locals = {
        title: 'Categoria',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('blog/category.ejs', { 
        locals,
     });
});

// GET - serch page
router.get('/search', (req, res) => {
    const locals = {
        title: 'Busca',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('blog/search.ejs', { 
        locals,
     });
});

export default router;