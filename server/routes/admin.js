import express from 'express';
const router = express.Router();

// Layouts
const adminLayout = '../views/layouts/admin-layout.ejs';

// GET - Admin page
router.get('/', async (req, res) => {
    try {
        const locals = {
            title: "Admin",
            description: "Simple blog created with NodeJs"
        }        
        res.render("admin/admin-index.ejs", { 
            locals,
            layout: adminLayout
        });
    } catch (error) {
        console.log(error);
    }
});

// GET - Create post
router.get('/create-post', async (req, res) => {
    try {
        const locals = {
            title: "Create post",
            description: "Create a new post"
        }        
        res.render("admin/create-post.ejs", { 
            locals,
            layout: adminLayout
        });
    } catch (error) {
        console.log(error);
    }
});

export default router;