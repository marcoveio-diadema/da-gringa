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

// GET - Blog index
router.get('/', async (req, res) => {
    try {
        
        // Fetch posts from the database
        const postsResult = await db.query(`
            SELECT posts.*, categories.category AS category_name, users.username AS author_username 
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id 
            INNER JOIN users ON posts.author_id = users.id 
            ORDER BY COALESCE(posts.updated_at, posts.created_at) DESC
        `);

        const posts = postsResult.rows;

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

     // fetch most viewed discussions
     const hotDiscussionsResult = await db.query(`
        SELECT title, slug, view_count
        FROM forum_discussions
        ORDER BY view_count DESC
        LIMIT 5
    `)

    const hotDiscussions = hotDiscussionsResult.rows;

    // fetch most viewed discussions
    const hotPostsResult = await db.query(`
        SELECT title, slug, view_count
        FROM posts
        ORDER BY view_count DESC
        LIMIT 5
    `)

    const hotPosts = hotPostsResult.rows;

        // locals and render the home page
        const locals = {
            title: 'Página Inicial',
            description: "Blog com artigos que te explicam tudo sobre como se virar na gringa!"
        }

        res.render('blog/blog-index.ejs', { 
            locals,
            user: req.user,
            posts,
            req: req,
            discussions,
            countries,
            hotTags,
            hotDiscussions,
            hotPosts,
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu ao tentarmos carregar os posts.' });
    }
});

// GET - Post page
router.get('/post/:slug', async (req, res) => {
    try {
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

            // Increment the view count
            await db.query('UPDATE posts SET view_count = view_count + 1 WHERE slug = $1', [slug]);

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
                SELECT comments.*, users.username AS author, users.profile_img AS author_img, users.id AS author_id, COUNT(comment_likes.user_id) AS likes_count, COUNT(comment_dislikes.user_id) AS dislikes_count,
                CASE WHEN comment_likes.user_id = $2 THEN true ELSE false END AS liked,
                CASE WHEN comment_dislikes.user_id = $2 THEN true ELSE false END AS disliked
                FROM comments
                INNER JOIN users ON comments.author_id = users.id
                LEFT JOIN comment_likes ON comments.id = comment_likes.comment_id
                LEFT JOIN comment_dislikes ON comments.id = comment_dislikes.comment_id
                WHERE comments.post_id = $1
                GROUP BY comments.id, users.username, users.profile_img, users.id, comment_likes.user_id, comment_dislikes.user_id
                ORDER BY comments.created_at DESC
            `, [post.id, req.user ? req.user.id : null]);
            const comments = commentsResult.rows;

            // fetch replies for each comment
            for (let comment of comments) {
                const replyResults = await db.query(`
                    SELECT replies.*, users.username AS author, users.profile_img AS author_img, COUNT(reply_likes.user_id) AS likes_count, COUNT(reply_dislikes.user_id) AS dislikes_count,
                    CASE WHEN reply_likes.user_id = $2 THEN true ELSE false END AS liked,
                    CASE WHEN reply_dislikes.user_id = $2 THEN true ELSE false END AS disliked
                    FROM replies
                    INNER JOIN users ON replies.author_id = users.id
                    LEFT JOIN reply_likes ON replies.id = reply_likes.reply_id
                    LEFT JOIN reply_dislikes ON replies.id = reply_dislikes.reply_id
                    WHERE replies.comment_id = $1
                    GROUP BY replies.id, users.username, users.profile_img, users.id, reply_likes.user_id, reply_dislikes.user_id
                    ORDER BY replies.created_at DESC
                `, [comment.id, req.user ? req.user.id : null]);
                comment.replies = replyResults.rows;
            }

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

            // fetch most viewed discussions
            const hotDiscussionsResult = await db.query(`
                SELECT title, slug, view_count
                FROM forum_discussions
                ORDER BY view_count DESC
                LIMIT 5
            `)
            const hotDiscussions = hotDiscussionsResult.rows;

            // fetch most viewed discussions
            const hotPostsResult = await db.query(`
                SELECT title, slug, view_count
                FROM posts
                ORDER BY view_count DESC
                LIMIT 5
            `)
            const hotPosts = hotPostsResult.rows;

            // locals and render the post page
            const locals = {
                title: post.title,
                description: post.intro
            }

            res.render('blog/post.ejs', {
                currentUrl: encodeURIComponent(req.originalUrl), 
                locals,
                post,
                otherPosts,
                comments,
                req: req,
                user: req.user,
                hotTags,
                discussions,
                countries,
                hotDiscussions,
                hotPosts,
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
         // Fetch all categories from the database
         const categoriesResult = await db.query('SELECT * FROM categories');
         const categories = categoriesResult.rows;

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
        const otherCategoriesResult = await db.query('SELECT * FROM categories');
        const otherCategories = otherCategoriesResult.rows.filter(category => category.id != categoryId);

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

        // fetch most viewed discussions
        const hotDiscussionsResult = await db.query(`
            SELECT title, slug, view_count
            FROM forum_discussions
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotDiscussions = hotDiscussionsResult.rows;

        // fetch most viewed discussions
        const hotPostsResult = await db.query(`
            SELECT title, slug, view_count
            FROM posts
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotPosts = hotPostsResult.rows;
        
        // locals and rendering
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
            categories,
            req: req,
            hotTags,
            discussions,
            countries,
            hotDiscussions,
            hotPosts,
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

// POST - like comment
router.post('/like-comment', async (req, res) => {
    const commentId = req.body.commentId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
            return res.json({ success: false, message: 'You have already liked this comment.', liked: false });
        }

        // Like the comment
        await db.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Comment liked successfully.', liked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the comment. Please try again.' });
    }
});

// POST - dislike comment
router.post('/dislike-comment', async (req, res) => {
    const commentId = req.body.commentId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
            return res.json({ success: false, message: 'You have already disliked this comment.', disliked: false });
        }

        // Like the comment
        await db.query('INSERT INTO comment_dislikes (comment_id, user_id) VALUES ($1, $2)', [commentId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Comment disliked successfully.', disliked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the comment. Please try again.' });
    }
});

// POST - like reply
router.post('/like-reply', async (req, res) => {
    const replyId = req.body.replyId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM reply_likes WHERE reply_id = $1 AND user_id = $2', [replyId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM reply_likes WHERE reply_id = $1 AND user_id = $2', [replyId, userId]);
            return res.json({ success: false, message: 'You have already liked this reply.', liked: false });
        }

        // Like the comment
        await db.query('INSERT INTO reply_likes (reply_id, user_id) VALUES ($1, $2)', [replyId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Reply liked successfully.', liked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the reply. Please try again.' });
    }
});

// POST - dislike reply
router.post('/dislike-reply', async (req, res) => {
    const replyId = req.body.replyId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM reply_dislikes WHERE reply_id = $1 AND user_id = $2', [replyId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM reply_dislikes WHERE reply_id = $1 AND user_id = $2', [replyId, userId]);
            return res.json({ success: false, message: 'You have already disliked this reply.', disliked: false });
        }

        // Like the comment
        await db.query('INSERT INTO reply_dislikes (reply_id, user_id) VALUES ($1, $2)', [replyId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Reply disliked successfully.', disliked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the reply. Please try again.' });
    }
});

export default router;