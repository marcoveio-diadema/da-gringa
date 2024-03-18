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

export default router;