import 'dotenv/config';
import express from 'express';
import sanitizeHtml from 'sanitize-html';
import bodyParser from 'body-parser';
import moment from 'moment';

const router = express.Router();

// Body parser
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.static("public"));


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
            SELECT posts.*, categories.category AS category_name, users.username AS author_username 
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id 
            INNER JOIN users ON posts.author_id = users.id 
            WHERE posts.slug = $1
        `, [slug]);

        // Check if a post was found
        if (result.rows.length > 0) {
            // Get the post
            const post = result.rows[0];

             // Fetch the other posts from the same category
            const otherPostsResult = await db.query(`
                SELECT posts.*, categories.category AS category_name, users.username AS author_username 
                FROM posts
                INNER JOIN categories ON posts.category_id = categories.id 
                INNER JOIN users ON posts.author_id = users.id 
                WHERE posts.category_id = $1 AND posts.id != $2
                ORDER BY posts.created_at DESC
                LIMIT 3
            `, [post.category_id, post.id]);
            const otherPosts = otherPostsResult.rows;

            const commentsResult = await db.query(`
                SELECT comments.*, users.username AS author, users.profile_img AS author_img 
                FROM comments
                INNER JOIN users ON comments.author_id = users.id 
                WHERE comments.post_id = $1
                ORDER BY comments.created_at DESC
            `, [post.id]);
            const comments = commentsResult.rows;

            // fetch replies for each comment
            for (let comment of comments) {
                const replyResults = await db.query(`
                    SELECT replies.*, users.username AS author, users.profile_img AS author_img
                    FROM replies
                    INNER JOIN users ON replies.author_id = users.id
                    WHERE replies.comment_id = $1
                    ORDER BY replies.created_at DESC
                `, [comment.id]);
                comment.replies = replyResults.rows;

            }

            // locals and render the post page
            const locals = {
                title: post.title,
                description: "Tudo sobre como se virar na gringa!"
            }

            res.render('blog/post.ejs', {
                currentUrl: encodeURIComponent(req.originalUrl), 
                locals,
                post,
                otherPosts,
                categories,
                comments,
                req: req,
                user: req.user,
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
        SELECT posts.*, categories.category AS category_name, users.username AS author_username
        FROM posts
        INNER JOIN categories ON posts.category_id = categories.id
        INNER JOIN users ON posts.author_id = users.id
        WHERE posts.category_id = $1
        ORDER BY COALESCE(posts.updated_at, posts.created_at) DESC
        `, [categoryId]);

        const posts = result.rows;

        // Fetch the specific category from the database
        const categoryResult = await db.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
        const category = categoryResult.rows[0];

        // Fetch all categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const otherCategories = categoriesResult.rows.filter(category => category.id != categoryId);
    
        const locals = {
        title: 'Categoria: ' + category.category,
        description: "Tudo sobre como se virar na gringa!"
        }
        res.render('blog/category.ejs', { 
            locals,
            user: req.user,
            posts,
            category,
            otherCategories,
            req: req
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
            SELECT posts.*, categories.category AS category_name, users.username AS author_username 
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id 
            INNER JOIN users ON posts.author_id = users.id 
            WHERE posts.content ILIKE $1 OR posts.title ILIKE $1 OR posts.intro ILIKE $1
            ORDER BY COALESCE(posts.updated_at, posts.created_at) DESC
        `, [`%${searchTerm}%`]);

        const posts = result.rows;

        // Fetch all categories from the database
        const categoriesResult = await db.query('SELECT * FROM categories');
        const categories = categoriesResult.rows;

        const locals = {
            title: 'Busca no blog',
            description: "Search results"
        }

        res.render('blog/search.ejs', { 
            locals,
            user: req.user,
            posts,
            categories,
            searchTerm,
            req: req
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'An error occurred while fetching the posts' });
    }
});

// POST - Comment
router.post('/comment', async (req, res) => {
    const comment_text = sanitizeHtml(req.body.comment);
    const post_id = req.body.postId;
    const author_id = req.user.id;

    try {
        // Insert the new comment into the database
        await db.query('INSERT INTO comments (comment, author_id, post_id) VALUES ($1, $2, $3)', [comment_text, author_id, post_id]);

        // If successful, send a success response
        res.json({ success: true, message: 'Comment added successfully.' });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to add the comment. Please try again.' });
    }
});

// DELETE - Comment
router.delete('/comment/:id', async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.id;

    try {
        // Check if the comment exists and belongs to the current user
        const comment = await db.query('SELECT * FROM comments WHERE id = $1 AND author_id = $2', [commentId, userId]);
        if (comment.rowCount === 0) {
            return res.json({ success: false, message: 'Comment not found or you do not have permission to delete this comment.' });
        }

        // Delete the comment
        await db.query('DELETE FROM comments WHERE id = $1', [commentId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Comment deleted successfully.' });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to delete the comment. Please try again.' });
    }
});

// POST - replies
router.post('/reply', async (req, res) => {
    const reply_text = sanitizeHtml(req.body.reply);
    const comment_id = req.body.commentId;
    const author_id = req.user.id;

    try {
        // Insert the new reply into the database
        await db.query('INSERT INTO replies (reply, author_id, comment_id) VALUES ($1, $2, $3)', [reply_text, author_id, comment_id]);

        // If successful, send a success response
        res.json({ success: true, message: 'Reply added successfully.' });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to add the reply. Please try again.' });
    }
});

// DELETE - Reply
router.delete('/reply/:id', async (req, res) => {
    const replyId = req.params.id;
    const userId = req.user.id;

    try {
        // Check if the comment exists and belongs to the current user
        const reply = await db.query('SELECT * FROM replies WHERE id = $1 AND author_id = $2', [replyId, userId]);
        if (reply.rowCount === 0) {
            return res.json({ success: false, message: 'Comment not found or you do not have permission to delete this comment.' });
        }

        // Delete the comment
        await db.query('DELETE FROM replies WHERE id = $1', [replyId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Reply deleted successfully.' });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to delete the comment. Please try again.' });
    }
});

export default router;