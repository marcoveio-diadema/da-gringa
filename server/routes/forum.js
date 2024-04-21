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

// GET - forum home page
router.get('/', (req, res) => {

    try {
        // locals and render the post page
    const locals = {
        title: 'Fórum da Gringa',
        description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
    }

    res.render('forum/forum-index.ejs',
        {
            locals: locals,
            req: req,
        }
    );
    } catch (error) {
        console.error('Error fetching forum posts:', error);
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos achar as perguntas do Fórum, tente novamente.' });
    }
});

// GET - new discussion page
router.get('/new-question', (req, res) => {

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
            }
        );
    } catch (error) {
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos carregar a página, tente novamente.' });
    }
});

// GET - Discussion details page
router.get('/discussion', (req, res) => {

    try {
        // locals and render the post page
        const locals = {
            title: 'Fórum da Gringa',
            description: 'Tuas dúvidas sobre a vida na gringa, respondidas por quem já passou por isso.'
        }

        res.render('forum/forum-discussion.ejs',
            {
                locals: locals,
                req: req,
            }
        );
    } catch (error) {
        // Render an error page
        res.status(500).render('500.ejs', { message: 'Um erro ocorreu enquanto tentavamos carregar a discussão, tente novamente.' });
    }
});

export default router;