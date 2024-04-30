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

// import functions
import config from '../helpers/functions.js';
const { generateDiscussionSlug, getTags, storage } = config;

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        // Store the original URL before redirecting to login
        console.log('Original URL:', req.originalUrl);
        res.cookie('redirectTo', req.originalUrl, { httpOnly: true });
        // Redirect to login page if not authenticated
        res.redirect('/user/login');
    }
}

// GET - forum home page
router.get('/', async (req, res) => {
    let tags = [];

    try {
        // fetch all discussions from db
        const result = await db.query(`
            SELECT forum_discussions.id, forum_discussions.title, forum_discussions.content, forum_discussions.user_id, forum_discussions.country, forum_discussions.slug, forum_discussions.created_at, forum_discussions.view_count, users.username AS author_username, users.profile_img AS author_img, ARRAY_AGG(tags.tag) AS tag_names, COALESCE(reply_counts.reply_count, 0) AS reply_count, COALESCE(like_counts.like_count, 0) AS like_count, COALESCE(dislike_counts.dislike_count, 0) AS dislike_count
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            LEFT JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS reply_count
                FROM discussion_replies
                GROUP BY discussion_id
            ) AS reply_counts ON forum_discussions.id = reply_counts.discussion_id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS like_count
                FROM discussion_likes
                GROUP BY discussion_id
            ) AS like_counts ON forum_discussions.id = like_counts.discussion_id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS dislike_count
                FROM discussion_dislikes
                GROUP BY discussion_id
            ) AS dislike_counts ON forum_discussions.id = dislike_counts.discussion_id
            GROUP BY forum_discussions.id, users.username, users.profile_img, reply_counts.reply_count, like_counts.like_count, dislike_counts.dislike_count
            ORDER BY forum_discussions.created_at DESC
        `);
        // Get the discussions
        const discussions = result.rows;

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

        // fetch most viewed posts
        const hotPostsResult = await db.query(`
            SELECT title, slug, view_count
            FROM posts
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotPosts = hotPostsResult.rows;
    
        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        res.render('forum/forum-index.ejs',
            {
                locals: locals,
                req: req,
                discussions,
                tags: tags,
                hotTags,
                countries,
                hotDiscussions,
                hotPosts,
            }
        );

    } catch (error) {
        console.error('Error fetching forum posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { 
            message: 'Um erro ocorreu enquanto tentavamos achar as perguntas do Fórum, tente novamente.'
        });
    }
});

// GET - new discussion page
router.get('/new-question', ensureAuthenticated, async (req, res) => {
    let tags = [];

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

    // fetch most viewed posts
    const hotPostsResult = await db.query(`
        SELECT title, slug, view_count
        FROM posts
        ORDER BY view_count DESC
        LIMIT 5
    `)
    const hotPosts = hotPostsResult.rows;

    try {
        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        res.render('forum/create-forum-question.ejs',
            {
                locals: locals,
                req: req,
                tags: tags,
                hotTags,
                countries,
                hotDiscussions,
                hotPosts,
            }
        );
    } catch (error) {
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos carregar a página, tente novamente.' });
    }
});

// POST - new discussion page
router.post('/new-question', ensureAuthenticated, async (req, res) => {
    try {
        // Get the form data
        const discussionTitle = sanitizeHtml(req.body.discussionTitle);
        const content = sanitizeHtml(req.body.content);
        const country = sanitizeHtml(req.body.country);
        let tags = req.body.tags;
        if (!Array.isArray(tags)) {
            tags = [tags];
        }
        tags = tags.map(tag => sanitizeHtml(tag));

        // Get the user id
        const userId = req.user.id;

        // Generate the slug from the title
        const slug = generateDiscussionSlug(discussionTitle);

        // Insert the post into the database
        const result = await db.query(`
            INSERT INTO forum_discussions (user_id, title, country, content, slug)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userId, discussionTitle, country, content, slug]);

        // create new discussion
        const newDiscussion = result.rows[0];
        // Get the id of the new discussion
        const discussionId = newDiscussion.id;

        // For each tag
        for (let tag of tags) {
            // Skip if the tag is empty
            if (tag.trim() === '') {
                continue;
            }

            // Check if the tag already exists
            let tagResult = await db.query(`
                SELECT * FROM forum_tags WHERE tag = $1
            `, [tag]);

            let tagId;
            if (tagResult.rows.length === 0) {
                // If the tag doesn't exist, insert it into the tags table
                tagResult = await db.query(`
                    INSERT INTO forum_tags (tag)
                    VALUES ($1)
                    RETURNING *
                `, [tag]);
                tagId = tagResult.rows[0].id;
            } else {
                tagId = tagResult.rows[0].id;
            }

            // Insert a row into the discussion_tags table
            await db.query(`
                INSERT INTO forum_discussion_tags (discussion_id, tag_id)
                VALUES ($1, $2)
            `, [discussionId, tagId]);
        }

        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        // Redirect to the post page
        res.redirect(`/forum/discussion/${newDiscussion.slug}`);


    } catch (error) {
        console.error('Error creating forum post:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos criar a discussão, tente novamente.' });
    }
});

// GET - edit discussion page
router.get('/edit-discussion/:slug', ensureAuthenticated, async (req, res) => {
    let tags = [];
    try {
        // Get the slug from the URL
        const slug = req.params.slug;

        // fetch discussion from db
        const result = await db.query(`
            SELECT forum_discussions.*, users.username AS author_username, users.profile_img AS author_img, tags.tag AS tag_name
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            LEFT JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id AND tags.tag IS NOT NULL
            WHERE forum_discussions.slug = $1
        `, [slug]);

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

        // fetch most viewed posts
        const hotPostsResult = await db.query(`
            SELECT title, slug, view_count
            FROM posts
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotPosts = hotPostsResult.rows;

        // check if a discussion was found
        if (result.rows.length === 0) {
            // Render a 404 page
            res.status(404).render('404.ejs', { message: 'Discussão não encontrada.' });
            return;
        } else {
            // Get the discussion
            const discussion = result.rows[0];
            // Get the tags
            const tags = [...new Set(result.rows.map(row => row.tag_name).filter(tag => tag !== null))];

            // locals and render the post page
            const locals = {
                title: 'Fórum da Gringa',
                description: discussion.title,
            }

            res.render('forum/edit-forum-question.ejs',
                {
                    locals: locals,
                    req: req,
                    discussion,
                    tags: tags,
                    hotTags,
                    countries,
                    hotDiscussions,
                    hotPosts,
                }
            );
        }
    } catch (error) {
        // Render an error page
        console.error(error);
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos carregar a discussão, tente novamente.' });
    }
});

// POST - edit discussion page
router.post('/edit-discussion/', ensureAuthenticated, async (req, res) => {
    try {
        // Get the form data
        const discussionTitle = sanitizeHtml(req.body.discussionTitle);
        const content = sanitizeHtml(req.body.content);
        const country = sanitizeHtml(req.body.country);
        const discussionId = req.body["discussionId"];

        let tags = req.body.tags;
        if (!Array.isArray(tags)) {
            tags = [tags];
        }
        tags = tags.map(tag => sanitizeHtml(tag));

        const slug = generateDiscussionSlug(discussionTitle);

        // Get the user id
        const userId = req.user.id;

        // Update the post in the database
        const result = await db.query(`
            UPDATE forum_discussions
            SET title = $1, country = $2, content = $3, slug = $4
            WHERE id = $5
            RETURNING *
        `, [discussionTitle, country, content, slug, discussionId]);

        const updatedDiscussion = result.rows[0];

        // Get the current tags for the discussion
        let currentTagsResult = await db.query(`
            SELECT tag FROM forum_tags
            INNER JOIN forum_discussion_tags ON forum_tags.id = forum_discussion_tags.tag_id
            WHERE forum_discussion_tags.discussion_id = $1
        `, [discussionId]);
        let currentTags = currentTagsResult.rows.map(row => row.tag);

        // For each new tag
        for (let tag of tags) {
            // Skip if the tag is empty
            if (tag.trim() === '') {
                continue;
            }

            // If the tag is not in the current list of tags, add it
            if (!currentTags.includes(tag)) {
                // Check if the tag already exists
                let tagResult = await db.query(`
                    SELECT * FROM forum_tags WHERE tag = $1
                `, [tag]);

                let tagId;
                if (tagResult.rows.length === 0) {
                    // If the tag doesn't exist, insert it into the tags table
                    tagResult = await db.query(`
                        INSERT INTO forum_tags (tag)
                        VALUES ($1)
                        RETURNING *
                    `, [tag]);
                    tagId = tagResult.rows[0].id;
                } else {
                    tagId = tagResult.rows[0].id;
                }

                // Insert the tag into the discussion_tags table
                await db.query(`
                    INSERT INTO forum_discussion_tags (discussion_id, tag_id)
                    VALUES ($1, $2)
                `, [discussionId, tagId]);
            }
        }

        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }
        
        // Redirect to the post page
        res.redirect(`/forum/discussion/${updatedDiscussion.slug}`);

    } catch (error) {
        console.error('Error editing forum post:', error);
        // Render an error page
        res.status(500).render('500.ejs', { 
            message: 'Um erro ocorreu enquanto tentavamos editar a discussão, tente novamente.'
        });
    }
});

// POST - delete discussion
router.post('/delete-discussion', ensureAuthenticated, async (req, res) => {
    try {
        // Get the discussion id
        const discussionId = req.body.discussionId;

        // Delete the discussion
        await db.query(`
            DELETE FROM forum_discussions
            WHERE id = $1
        `, [discussionId]);

        // Redirect to the forum home page
        res.redirect('/forum');

    } catch (error) {
        console.error('Error deleting forum post:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos deletar a discussão, tente novamente.' });
    }
});

// GET - Discussion details page
router.get('/discussion/:slug', async (req, res) => {   
    try {
        // Get the slug from the URL
        const slug = req.params.slug;

        // fetch discussion from db
        const discussionResult = await db.query(`
            SELECT forum_discussions.*, users.username AS author_username, users.profile_img AS author_img, tags.tag AS tag_name, users.id AS author_id, COUNT(discussion_likes.user_id) AS likes_count, COUNT(discussion_dislikes.user_id) AS dislikes_count,
            CASE WHEN discussion_likes.user_id = $2 THEN true ELSE false END AS liked,
            CASE WHEN discussion_dislikes.user_id = $2 THEN true ELSE false END AS disliked
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            LEFT JOIN discussion_likes ON forum_discussions.id = discussion_likes.discussion_id
            LEFT JOIN discussion_dislikes ON forum_discussions.id = discussion_dislikes.discussion_id
            LEFT JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            WHERE forum_discussions.slug = $1
            GROUP BY forum_discussions.id, users.username, users.profile_img, users.id, discussion_likes.user_id, discussion_dislikes.user_id, tags.tag
        `, [slug, req.user ? req.user.id : null]);

        // check if a discussion was found
        if (discussionResult.rows.length === 0) {
            // Render a 404 page
            res.status(404).render('404.ejs', { message: 'Discussão não encontrada.' });
            return;
        } else {
            // Get the discussion
            const discussion = discussionResult.rows[0];
            // Get the tags
            const tags = discussionResult.rows.map(row => row.tag_name).filter(tag => tag !== null);

            // Increment the view count
            await db.query('UPDATE forum_discussions SET view_count = view_count + 1 WHERE slug = $1', [slug]);

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

            // replies
            const discussionId = discussion.id

            const repliesResult = await db.query(`
                SELECT discussion_replies.*, users.username AS author_username, users.profile_img AS author_img, users.id AS author_id, COUNT(discussion_reply_likes.user_id) AS likes_count, COUNT(discussion_reply_dislikes.user_id) AS dislikes_count,
                CASE WHEN discussion_reply_likes.user_id = $2 THEN true ELSE false END AS liked,
                CASE WHEN discussion_reply_dislikes.user_id = $2 THEN true ELSE false END AS disliked
                FROM discussion_replies
                INNER JOIN users ON discussion_replies.author_id = users.id
                LEFT JOIN discussion_reply_likes ON discussion_replies.id = discussion_reply_likes.reply_id
                LEFT JOIN discussion_reply_dislikes ON discussion_replies.id = discussion_reply_dislikes.reply_id
                WHERE discussion_replies.discussion_id = $1
                GROUP BY discussion_replies.id, users.username, users.profile_img, users.id, discussion_reply_likes.user_id, discussion_reply_dislikes.user_id
                ORDER BY discussion_replies.created_at DESC
            `, [discussionId, req.user ? req.user.id : null]);
            const discussionReplies = repliesResult.rows;

            // fetch most viewed discussions
            const hotDiscussionsResult = await db.query(`
                SELECT title, slug, view_count
                FROM forum_discussions
                ORDER BY view_count DESC
                LIMIT 5
            `)
            const hotDiscussions = hotDiscussionsResult.rows;

            // fetch most viewed posts
            const hotPostsResult = await db.query(`
                SELECT title, slug, view_count
                FROM posts
                ORDER BY view_count DESC
                LIMIT 5
            `)
            const hotPosts = hotPostsResult.rows;

            // locals and render the post page
            const locals = {
                title: 'Fórum da Gringa',
                description: discussion.title,
            }

            res.render('forum/forum-discussion.ejs',
                {
                    locals: locals,
                    req: req,
                    discussion,
                    tags: tags,
                    hotTags,
                    countries,
                    discussionReplies,
                    hotDiscussions,
                    hotPosts,
                }
            );
        }
    } catch (error) {
        // Render an error page
        console.error(error);
        res.status(500).render('500.ejs', { 
            message: 'Um erro ocorreu enquanto tentavamos carregar a discussão, tente novamente.'
        });
    }
});

// GET - for auto completion tags input
router.get('/get-tags', function(req, res) {
    let term = req.query.term;
    getTags(term, function(err, tags) {
        if (err) {
            console.error(err);
            res.status(500).send(err);
        } else {
            res.json(tags);
        }
    });
});

// GET - Discussions by tag
router.get('/tag/:tag', async (req, res) => {
    try {
        // Get the tag from the URL
        const tag = req.params.tag;

        // fetch discussions from db
        const discussionsResult = await db.query(`
            SELECT forum_discussions.*, users.username AS author_username, users.profile_img AS author_img, tags.tag AS tag_name, COALESCE(reply_counts.reply_count, 0) AS reply_count, COALESCE(like_counts.like_count, 0) AS like_count, COALESCE(dislike_counts.dislike_count, 0) AS dislike_count
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            INNER JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            INNER JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS reply_count
                FROM discussion_replies
                GROUP BY discussion_id
            ) AS reply_counts ON forum_discussions.id = reply_counts.discussion_id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS like_count
                FROM discussion_likes
                GROUP BY discussion_id
            ) AS like_counts ON forum_discussions.id = like_counts.discussion_id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS dislike_count
                FROM discussion_dislikes
                GROUP BY discussion_id
            ) AS dislike_counts ON forum_discussions.id = dislike_counts.discussion_id
            WHERE tags.tag = $1
        `, [tag]);
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

        // fetch most viewed discussions
        const hotDiscussionsResult = await db.query(`
            SELECT title, slug, view_count
            FROM forum_discussions
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotDiscussions = hotDiscussionsResult.rows;

        // fetch most viewed posts
        const hotPostsResult = await db.query(`
            SELECT title, slug, view_count
            FROM posts
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotPosts = hotPostsResult.rows;

        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        res.render('forum/tag-discussions.ejs',
            {
                locals: locals,
                req: req,
                discussions,
                tag: tag,
                hotTags,
                countries,
                hotDiscussions,
                hotPosts,
            }
        );
    } catch (error) {
        // Render an error page
        console.error(error);
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos carregar as discussões, tente novamente.' });
    }
});

// GET - Discussions per country
router.get('/country/:country', async (req, res) => {
    try {
        // Get the tag from the URL
        const country = req.params.country;

        // Get the discussion per countries
        const countryResult = await db.query(`
            SELECT DISTINCT ON (forum_discussions.id) forum_discussions.*, users.username AS author_username, users.profile_img AS author_img, tags.tag AS tag_name, COALESCE(reply_counts.reply_count, 0) AS reply_count, COALESCE(like_counts.like_count, 0) AS like_count, COALESCE(dislike_counts.dislike_count, 0) AS dislike_count
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            INNER JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            INNER JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS reply_count
                FROM discussion_replies
                GROUP BY discussion_id
            ) AS reply_counts ON forum_discussions.id = reply_counts.discussion_id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS like_count
                FROM discussion_likes
                GROUP BY discussion_id
            ) AS like_counts ON forum_discussions.id = like_counts.discussion_id
            LEFT JOIN (
                SELECT discussion_id, COUNT(*) AS dislike_count
                FROM discussion_dislikes
                GROUP BY discussion_id
            ) AS dislike_counts ON forum_discussions.id = dislike_counts.discussion_id
            WHERE forum_discussions.country = $1
        `, [country]);
        const discussions = countryResult.rows;

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

        // fetch most viewed posts
        const hotPostsResult = await db.query(`
            SELECT title, slug, view_count
            FROM posts
            ORDER BY view_count DESC
            LIMIT 5
        `)
        const hotPosts = hotPostsResult.rows;

        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        res.render('forum/tag-discussions.ejs',
            {
                locals: locals,
                req: req,
                discussions,
                hotTags,
                country,
                countries,
                hotDiscussions,
                hotPosts,
            }
        );

    } catch (error) {
        // Render an error page
        console.error(error);
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos carregar as discussões, tente novamente.' });
    }
});

// POST - Discussion replies
router.post('/discussion-reply', async (req, res) => {
    const reply_text = sanitizeHtml(req.body.discussionReply);
    const discussion_id = req.body.discussionId;
    const author_id = req.user.id;

    try {
        // Insert the new comment into the database
        await db.query('INSERT INTO discussion_replies (reply, author_id, discussion_id) VALUES ($1, $2, $3)', [reply_text, author_id, discussion_id]);

        // If successful, send a success response
        res.json({ success: true, message: 'Comment added successfully.' });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to add the comment. Please try again.' });
    }
});

// DELETE - Discussion reply
router.delete('/discussion-reply/:id', async (req, res) => {
    const discussionReplyId = req.params.id;
    const userId = req.user.id;

    try {
        // Check if the comment exists and belongs to the current user
        const discussionReply = await db.query('SELECT * FROM discussion_replies WHERE id = $1 AND author_id = $2', [discussionReplyId, userId]);
        if (discussionReply.rowCount === 0) {
            return res.json({ success: false, message: 'Comment not found or you do not have permission to delete this comment.' });
        }

        // Delete the comment
        await db.query('DELETE FROM discussion_replies WHERE id = $1', [discussionReplyId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Comment deleted successfully.' });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to delete the comment. Please try again.' });
    }
});

// POST - like discussion
router.post('/like-discussion', async (req, res) => {
    const discussionId = req.body.discussionId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM discussion_likes WHERE discussion_id = $1 AND user_id = $2', [discussionId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM discussion_likes WHERE discussion_id = $1 AND user_id = $2', [discussionId, userId]);
            return res.json({ success: false, message: 'You have already liked this discussion.', liked: false });
        }

        // Like the comment
        await db.query('INSERT INTO discussion_likes (discussion_id, user_id) VALUES ($1, $2)', [discussionId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Discussion liked successfully.', liked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the comment. Please try again.' });
    }
});

// POST - dislike discussion
router.post('/dislike-discussion', async (req, res) => {
    const discussionId = req.body.discussionId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM discussion_dislikes WHERE discussion_id = $1 AND user_id = $2', [discussionId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM discussion_dislikes WHERE discussion_id = $1 AND user_id = $2', [discussionId, userId]);
            return res.json({ success: false, message: 'You have already disliked this discussion.', liked: false });
        }

        // Like the comment
        await db.query('INSERT INTO discussion_dislikes (discussion_id, user_id) VALUES ($1, $2)', [discussionId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Discussion disliked successfully.', liked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to dislike the discussion. Please try again.' });
    }
});

// POST - like reply
router.post('/like-discussion-reply', async (req, res) => {
    const discussionReplyId = req.body.discussionReplyId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM discussion_reply_likes WHERE reply_id = $1 AND user_id = $2', [discussionReplyId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM discussion_reply_likes WHERE reply_id = $1 AND user_id = $2', [discussionReplyId, userId]);
            return res.json({ success: false, message: 'You have already liked this reply.', liked: false });
        }

        // Like the comment
        await db.query('INSERT INTO discussion_reply_likes (reply_id, user_id) VALUES ($1, $2)', [discussionReplyId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Reply liked successfully.', liked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the reply. Please try again.' });
    }
});

// POST - dislike reply
router.post('/dislike-discussion-reply', async (req, res) => {
    const discussionReplyId = req.body.discussionReplyId;
    const userId = req.user.id;

    try {
        // Check if the user has already liked the comment
        const like = await db.query('SELECT * FROM discussion_reply_dislikes WHERE reply_id = $1 AND user_id = $2', [discussionReplyId, userId]);
        if (like.rowCount > 0) {
            await db.query('DELETE FROM discussion_reply_dislikes WHERE reply_id = $1 AND user_id = $2', [discussionReplyId, userId]);
            return res.json({ success: false, message: 'You have already disliked this reply.', disliked: false });
        }

        // Like the comment
        await db.query('INSERT INTO discussion_reply_dislikes (reply_id, user_id) VALUES ($1, $2)', [discussionReplyId, userId]);

        // If successful, send a success response
        res.json({ success: true, message: 'Reply disliked successfully.', disliked: true });
    } catch (error) {
        // If an error occurred, send an error response
        res.json({ success: false, message: 'An error occurred while trying to like the reply. Please try again.' });
    }
});

export default router;