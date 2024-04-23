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
const { uploadImage, customSanitizeHtml, generateDiscussionSlug, handleImageUpload, storage } = config;

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
            SELECT forum_discussions.id, forum_discussions.title, forum_discussions.content, forum_discussions.user_id, forum_discussions.country, forum_discussions.slug, forum_discussions.created_at, users.username AS author_username, users.profile_img AS author_img, ARRAY_AGG(tags.tag) AS tag_names
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            LEFT JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            GROUP BY forum_discussions.id, users.username, users.profile_img
            ORDER BY forum_discussions.created_at DESC
        `);

        // Get the discussions
        const discussions = result.rows;
    
        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        res.render('forum/forum-index.ejs',
            {
                locals: locals,
                req: req,
                discussions: discussions,
                tags: tags,
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
router.get('/new-question', ensureAuthenticated, (req, res) => {
    let tags = [];
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
        console.log('Inserted discussion into database');

        // create new discussion
        const newDiscussion = result.rows[0];
        // Get the id of the new discussion
        const discussionId = newDiscussion.id;

        // For each tag
        for (let tag of tags) {
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
        console.log('Redirected');


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
                    discussion: discussion,
                    tags: tags,
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
        const result = await db.query(`
            SELECT forum_discussions.*, users.username AS author_username, users.profile_img AS author_img, tags.tag AS tag_name
            FROM forum_discussions
            INNER JOIN users ON forum_discussions.user_id = users.id
            LEFT JOIN forum_discussion_tags ON forum_discussions.id = forum_discussion_tags.discussion_id
            LEFT JOIN forum_tags AS tags ON forum_discussion_tags.tag_id = tags.id
            WHERE forum_discussions.slug = $1
        `, [slug]);

        // check if a discussion was found
        if (result.rows.length === 0) {
            // Render a 404 page
            res.status(404).render('404.ejs', { message: 'Discussão não encontrada.' });
            return;
        } else {
            // Get the discussion
            const discussion = result.rows[0];
            // Get the tags
            const tags = result.rows.map(row => row.tag_name).filter(tag => tag !== null);

            // locals and render the post page
            const locals = {
                title: 'Fórum da Gringa',
                description: discussion.title,
            }

            res.render('forum/forum-discussion.ejs',
                {
                    locals: locals,
                    req: req,
                    discussion: discussion,
                    tags: tags,
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


export default router;