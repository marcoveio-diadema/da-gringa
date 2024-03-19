import express from 'express';
const router = express.Router();

// GET - Post page
router.get('/post', (req, res) => {
    const locals = {
        title: 'Blog',
        description: "Tudo sobre como se virar na gringa!"
    }
    res.render('blog/post.ejs', { 
        locals,
     });
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