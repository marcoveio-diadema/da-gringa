import express from 'express';
import bodyParser from 'body-parser';
import sanitizeHtml from 'sanitize-html';
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
            categories,
            req: req
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

export default router;