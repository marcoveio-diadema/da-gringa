import 'dotenv/config';
import express from 'express';
const router = express.Router();
import bodyParser from 'body-parser';
import multer from 'multer';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import sanitizeHtml from 'sanitize-html';

// import db
import db from '../config/db.js';

// import functions
import config from '../helpers/functions.js';
const { uploadImage, customSanitizeHtml, generateSlug } = config;

// set number of salts
const saltRounds = 10;

// Body parser
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.static("public"));

// multer storage
const upload = multer({ dest: 'uploads/' });

// middleware to check if user is admin
function isAdmin(req, res, next) {
    if (req.user) {
        if (req.user.is_admin) {
            next();
        } else {
            const locals = {
                title: 'Acesso negado',
                description: 'Você não tem permissão para realizar esta ação.'
            }
            res.status(403).render('403.ejs', { 
                message: 'Acesso negado, você não tem permissão para realizar esta ação',
                locals,
            });
        }
    } else {
        next();
    }
}

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    } else {
      // Redirect to login page if not authenticated
      res.redirect('/user/login');
    }
}


// GET - Admin page
router.get('/', isAdmin, ensureAuthenticated, async (req, res) => {
    try {
        const locals = {
            title: "Admin",
            description: "Simple blog created with NodeJs"
        }   
        
        // fetch data from db
        const categoriesResult = await db.query("SELECT * FROM categories ORDER BY id DESC");
        const categories = categoriesResult.rows;

        const usersResult = await db.query("SELECT * FROM users ORDER BY id DESC");
        const users = usersResult.rows;

        const allPostsResult = await db.query(`
        SELECT post.*, categories.category AS category_name, users.username AS author_username 
        FROM post
        INNER JOIN categories ON post.category = categories.id 
        INNER JOIN users ON post.author = users.id 
        ORDER BY post.created_at DESC
    `);
        const allPosts = allPostsResult.rows;

        res.render("user/admin-index.ejs", { 
            locals,
            user: req.user,
            categories,
            users,
            allPosts,
        });
    } catch (error) {
        console.log(error);
    }
});

// GET - Create post
router.get('/create-post', ensureAuthenticated, isAdmin, async (req, res) => {
    try {
        // Fetch all categories from the database
        const result = await db.query('SELECT * FROM categories');
        const categories = result.rows;

        const locals = {
            title: "Create post",
            description: "Create a new post",
        }        
        res.render("user/create-post.ejs", { 
            locals,
            categories,
            user: req.user,
        });
    } catch (error) {
        console.log(error);
    }
});

// POST - create post
router.post('/create-post', ensureAuthenticated, isAdmin, upload.single('img_background'), async(req, res) => {
    // Upload the image to Google Cloud Storage
    const imageUrl = await uploadImage(req.file, 'posts/');
    // other data from form
    const title = req.body["title"];
    const intro = req.body["intro"];
    const content = customSanitizeHtml(req.body["content"]);
    const categoryId = req.body["category"];

    // Generate the slug from the title
    const slug = generateSlug(title);

    // Get the author's ID from the session or JWT
    const authorId = req.user.id;

    try {
        // Insert the post into the database
        const result = await db.query('INSERT INTO post (title, slug, intro, content, img_background, category, author) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [title, slug, intro, content, imageUrl, categoryId, authorId ]);
        const newPost = result.rows[0];
    
        // Redirect to the post page
        res.redirect(`/blog/post/${newPost.slug}`);
    } catch (error) {
        console.error('Error creating post:', error);
        // Set the error message
        const errorMessage = 'Error creating post';

        // Fetch all categories from the database
        const result = await db.query('SELECT * FROM categories');
        const categories = result.rows;
        
        // Redirect to the create-post page with the error message
        res.render('user/create-post.ejs', { 
            title: 'Novo post',
            errorMessage,
            categories,
            user: req.user,
        });
    }

});

// DELETE - delete post
router.post('/delete-post', ensureAuthenticated, isAdmin, async (req, res) => {
    try {
        // fetch post data
        const postId = req.body.postId;
        // Delete the post from the database
        const result = await db.query('DELETE FROM post WHERE id = $1', [postId]);
    
        // Redirect to the admin page
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting post:', error);
        // Set the error message
        const errorMessage = 'Error deleting post';
        
        // Redirect to the admin page with the error message
        res.redirect('/', { 
            errorMessage,
            user: req.user,
        });
    }
});

// POST - Create category
router.post('/new-category', ensureAuthenticated, isAdmin, async (req, res) => {
    try {
        const category = sanitizeHtml(req.body.categoryName);
        const result = await db.query("INSERT INTO categories (category) VALUES ($1) RETURNING *", [category]);
        res.redirect('/admin');
    } catch (error) {
        console.log(error);
    }
});

// POST - Delete category
router.post('/delete-category', ensureAuthenticated, isAdmin, async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const result = await db.query("DELETE FROM categories WHERE id = $1", [categoryId]);
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

export default router;