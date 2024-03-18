import express from 'express';
const router = express.Router();

// GET - home page
router.get('/', (req, res) => {
    const locals = {
        title: 'Página Inicial',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('main/index.ejs', { 
        locals,
     });
});

// GET - contact page
router.get('/contact', (req, res) => {
    const locals = {
        title: 'Contato',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('main/contact.ejs', { 
        locals,
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
     });
});

export default router;