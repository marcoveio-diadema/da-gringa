import 'dotenv/config';

import express from 'express';
import expressLayout from 'express-ejs-layouts';

// import routes
import mainRoutes from './server/routes/main.js';
import adminRoutes from './server/routes/admin.js';
import blogRoutes from './server/routes/blog.js';

// express
const app = express();
const PORT = 3000 || process.env.PORT;

// static
app.use(express.static('public'));

// middleware for templating
app.use(expressLayout);
app.set('layout', './layouts/main');
app.set('view engine', 'ejs');


app.use('/', mainRoutes);
app.use('/admin', adminRoutes);
app.use('/blog', blogRoutes);

// app listener
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`)
});