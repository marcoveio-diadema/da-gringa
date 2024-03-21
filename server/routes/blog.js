import express from 'express';
const router = express.Router();

// import db
import db from '../config/db.js';

// GET - Post page
router.get('/post/:slug', async (req, res) => {
    try {
        // Fetch all categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const categories = categoriesResult.rows;
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
                categories,
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
router.get('/category/:categoryId', async (req, res) => {
    try {
        // fetch category ID from the URL
        const categoryId = req.params.categoryId;

        // fetch posts from the database
        const result = await db.query(`
        SELECT post.*, categories.category AS category_name, users.username AS author_username
        FROM post
        INNER JOIN categories ON post.category = categories.id
        INNER JOIN users ON post.author = users.id
        WHERE post.category = $1
        ORDER BY post.created_at DESC
        `, [categoryId]);

        const posts = result.rows;

        // Fetch the specific category from the database
        const categoryResult = await db.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
        const category = categoryResult.rows[0];

        // Fetch all categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const otherCategories = categoriesResult.rows.filter(category => category.id != categoryId);
    
        const locals = {
        title: 'Categoria',
        description: "Tudo sobre como se virar na gringa!"
        }
        res.render('blog/category.ejs', { 
            locals,
            user: req.user,
            posts,
            category,
            otherCategories,
         });
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'An error occurred while fetching the posts' });
    }
});


// GET - Search page
router.get('/search', async (req, res) => {
    try {
        // Fetch the search term from the query parameters
        const searchTerm = req.query.q;

        // Fetch posts from the database
        const result = await db.query(`
            SELECT post.*, categories.category AS category_name, users.username AS author_username 
            FROM post
            INNER JOIN categories ON post.category = categories.id 
            INNER JOIN users ON post.author = users.id 
            WHERE post.content ILIKE $1 OR post.title ILIKE $1 OR post.intro ILIKE $1
            ORDER BY post.created_at DESC
        `, [`%${searchTerm}%`]);

        const posts = result.rows;

        // Fetch all categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const categories = categoriesResult.rows;

        const locals = {
            title: 'Search',
            description: "Search results"
        }

        res.render('blog/search.ejs', { 
            locals,
            user: req.user,
            posts,
            categories,
            searchTerm,
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'An error occurred while fetching the posts' });
    }
});

export default router;