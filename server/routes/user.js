import 'dotenv/config';
import express from 'express';
const router = express.Router();
import bodyParser from 'body-parser';
import multer from 'multer';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import sanitizeHtml from 'sanitize-html';
import crypto from 'crypto';

// import db
import db from '../config/db.js';

// import functions
import config from '../helpers/functions.js';
const { uploadImage, sendPasswordResetEmail } = config;

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


// GET - profile
router.get('/profile', ensureAuthenticated, async (req, res) => {
    try {
        const locals = {
            title: "Perfil",
            description: "User profile"
        }        
        res.render("user/profile.ejs", { 
            locals,
            user: req.user,
        });
    } catch (error) {
        console.log(error);
    }
});

// POST - edit profile
router.post('/edit-profile', ensureAuthenticated, async (req, res) => {
    try {
        // Get the current user data
        const result = await db.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
        const user = result.rows[0];

        // Update the user's information
        await db.query(
            `UPDATE users SET username = $1, first_name = $2, last_name = $3, email = $4, bio = $5 WHERE id = $6`,
            [
                req.body.inputUsername || user.username,
                req.body.inputFirstName || user.first_name,
                req.body.inputLastName || user.last_name,
                req.body.inputEmailAddress || user.email,
                req.body.inputBio || user.bio,
                req.user.id
            ]
        );

        // Fetch the updated user data
        const updatedResult = await db.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
        const updatedUser = updatedResult.rows[0];

        // Attach the updated user data to the request
        req.session.passport.user = updatedUser;

        // Redirect to the profile page
        res.redirect('/user/profile');
    } catch (error) {
        console.log(error);
    }
});

// POST - edit picture
router.post('/update-picture', ensureAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
        const profilePicture = await uploadImage(req.file, 'profile/');
        await db.query(
            `UPDATE users SET profile_img = $1 WHERE id = $2`,
            [profilePicture, req.user.id]
        );

        // Fetch the updated user data
        const updatedResult = await db.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
        const updatedUser = updatedResult.rows[0];

        // Attach the updated user data to the request
        req.session.passport.user = updatedUser;

        // Redirect to the profile page
        res.redirect('/user/profile');
    } catch (error) {
        console.log(error);
    }
});

// POST - change password
router.post('/change-password', ensureAuthenticated, async (req, res) => {
    try {
        // Get the current user data
        const result = await db.query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
        const user = result.rows[0];

        // Check if the current password is correct
        const isMatch = await bcrypt.compare(req.body.inputCurrentPassword, user.password);
        if (!isMatch) {
            // Handle incorrect password
            return res.status(400).send('Incorrect password');
        }

        // Check if the new password and confirmation match
        if (req.body.inputNewPassword !== req.body.inputConfirmPassword) {
            // Handle non-matching passwords
            return res.status(400).send('Passwords do not match');
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.inputNewPassword, salt);

        // Update the user's password
        await db.query(
            `UPDATE users SET password = $1 WHERE id = $2`,
            [hashedPassword, req.user.id]
        );

        // Redirect to the profile page
        res.redirect('/user/profile');
    } catch (error) {
        console.log(error);
    }
});

// POST - delete account
router.post('/delete-profile', ensureAuthenticated, async (req, res) => {
    try {
        // Delete the user's account
        await db.query(`DELETE FROM users WHERE id = $1`, [req.user.id]);

        // Log the user out
        req.logout();
        
        // Redirect to the login page
        req.flash('error', 'Uma pena te ver partir.');
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});
// GET - signup
router.get('/signup', async (req, res) => {
    try {
        const locals = {
            title: "Signup",
            description: "Signup to admin"
        }        
        res.render("user/signup.ejs", { 
            locals,
            user: req.user,
            formData: req.flash('formData')[0] 
        });
    } catch (error) {
        console.log(error);
    }
});

// POST - signup
router.post("/signup", upload.single('profilePicture'), async (req, res) => {
    // get data from form
    const profilePicture = req.file ? await uploadImage(req.file, 'profile/') : null;
    const firstName = sanitizeHtml(req.body.firstName);
    const lastName = sanitizeHtml(req.body.lastName);
    const email = sanitizeHtml(req.body.email);
    const username = sanitizeHtml(req.body.username);
    const password = sanitizeHtml(req.body.password);
    const confirmPassword = sanitizeHtml(req.body.confirmPassword);
    const userBio = req.body.userBio ? sanitizeHtml(req.body.userBio) : null;
    const newsletter = req.body.newsletter;

    console.log('Newsletter:', req.body.newsletter);

    // Validate form inputs
    if (!firstName || !lastName || !email || !username || !password || !confirmPassword) {
        req.flash('error', 'Todos os campos marcados com * são obrigatórios.');
        req.flash('formData', { firstName, lastName, email, username, userBio });
        return res.redirect('/user/signup');
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        req.flash('error', 'Senhas não coincidem.');
        return res.redirect('/user/signup');
    }

    try {
        // check if user already exists
      const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]
      );
        // if user already exists
      if (checkResult.rows.length > 0) {
        req.flash('error', 'Email já cadastrado, utilize outro email ou faça o login.');
        return res.redirect('/user/signup');
      } else {
        // if user wants to subscribe to the newsletter
        if (newsletter) {
            const checkSubscriber = await db.query("SELECT * FROM subscribers WHERE email = $1", [email]);
            if (checkSubscriber.rows.length > 0) {
                req.flash('error', 'Email já cadastrado na newsletter.');
                console.log('Email já cadastrado na newsletter.');
                return res.redirect('/user/signup');
            } else {
                await db.query("INSERT INTO subscribers (email) VALUES ($1)", [email]);
                console.log('Email cadastrado na newsletter.');
            }
        }
        // password hashing
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          // error handling
          if (err) {
            console.log("Error hashing password", err);
          } else {
          const result = await db.query(
            "INSERT INTO users (first_name, last_name, email, username, password, profile_img, bio) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [firstName, lastName, email, username, hash, profilePicture, userBio]
          );
            const user = result.rows[0];

            // Log the user in
            req.login(user, (err) => {
              if (err) {
                console.log("Error logging in", err);
              } else {
                req.flash('success', 'Bem vindo a nossa comunidade!');
                res.redirect("/");
              }
            });
          }
          });
      }
    } catch (err) {
      console.log(err);
    }
  });

// GET - login
router.get('/login', async (req, res) => {
    try {
        const locals = {
            title: "Login",
            description: "Login to admin"
        }        
        res.render("user/login.ejs", { 
            locals,
            user: req.user,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
    } catch (error) {
        console.log(error);
    }
});

// POST - login
router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) { 
            req.flash('error', 'Um erro aconteceu, tente novamente.');
            return res.redirect('/user/login');
        }
        if (!user) { 
            req.flash('error', 'Email ou senha incorretos, tente novamente.');
            return res.redirect('/user/login'); 
        }
        req.logIn(user, (err) => {
            if (err) { 
                req.flash('error', 'Um erro aconteceu, tente novamente.');
                return res.redirect('/user/login');; 
            }
            // Redirect user based on their ID
            if (user.id === 1) {
                return res.redirect('/admin/');
            } else {
                return res.redirect('/');
            }
        });
    })(req, res, next);
});

// GET - logout
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/user/login');
    });
});

// passport local strategy
passport.use(new LocalStrategy({
    usernameField: "email",
    passwordField: "password"
    },
    async function verify(email, password, cb) {
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1",[
        email
        ]);

        if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;

        // compare password
        bcrypt.compare(password, storedHashedPassword, (err, result) => {
            if (err) {
            return cb(err);
        } else {
            if (result) {
            return cb(null, user);
            } else {
            return cb(null, false, { message: 'Email ou senha incorretos, tente novamente.' });
            }
        }
        });

        } else {
        return cb(null, false, { message: 'Email ou senha incorretos, tente novamente.' });}
    } catch (err) {
        return cb(err);
    }
}));

// serialize and deserialize user
passport.serializeUser((user, cb) => {
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    cb(null, user);
});

// GET - forgot password
router.get("/forgot-password", (req, res) => {
    const locals = {
        title: "Esqueci a senha",
        description: "Reinicio de senha"
    }   
    res.render("user/forgot-password.ejs", {
        locals,
        user: req.user,    });
});

// POST - forgot password
router.post("/forgot-password", async (req, res) => {
    const email = req.body.email;
    // Check if user exists
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
        // User exists, send password reset email
        // Generate a password reset token
        const token = crypto.randomBytes(20).toString('hex');
        // Store the token and the expiration time in the database
        await db.query("UPDATE users SET reset_token = $1 WHERE email = $2", [token, email]);
        // send email
        await sendPasswordResetEmail(email, token);
        // message to user
        req.flash('success', 'Email enviado com sucesso!');
    } else {
        // User does not exist
        req.flash('error', 'Email não encontrado, tente novamente.');
    }
    res.redirect('/user/forgot-password');
});

// GET - reset password
router.get('/reset-password/:token', async (req, res) => {
    // Find a user with the reset token
    const result = await db.query("SELECT * FROM users WHERE reset_token = $1", [req.params.token]);

    const locals = {
        title: "Reiniciar a senha",
        description: "Reinicio de senha",
        error: req.session.error
    }
    delete req.session.error;   
    if (result.rows.length > 0) {
        // If the token is found, render the password reset form
        res.render('user/reset-password', { 
            token: req.params.token,
            locals,});
    } else {
        // If the token is not found, redirect to the forgot password page with an error message
        req.flash('error', 'Código de recuperação inválido ou expirado, digite seu email novamente para recever um novo código.');
        res.redirect('/user/forgot-password');
    }
});

// POST - reset password
router.post('/reset-password/:token', async (req, res) => {
    const password = req.body.resetPassword;
    const confirmPassword = req.body.resetPasswordConfirm;

    console.log('Session: ', req.session);
    console.log('Token: ', req.params.token);

    // Check if password and confirmPassword are the same
    if (password !== confirmPassword) {
        req.session.error = ('As senhas não coincidem, digite novamente.');
        return res.redirect('/user/reset-password/' + req.params.token);
    }

    // Find a user with the reset token
    const result = await db.query("SELECT * FROM users WHERE reset_token = $1", [req.params.token]);
    if (result.rows.length > 0) {
        // If the token is found, hash the new password and update it in the database
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query("UPDATE users SET password = $1 WHERE reset_token = $2", [hashedPassword, req.params.token]);
        req.flash('success', 'Sua senha foi reiniciada com sucesso, faça o login.');
        res.redirect('/user/login');
    } else {
        // If the token is not found, redirect to the forgot password page with an error message
        req.flash('error', 'Código de recuperação inválido ou expirado, digite seu email novamente para recever um novo código.');
        res.redirect('/user/forgot-password');
    }
});
// POST - newsletter subscribe
router.post('/subscribe', async (req, res) => {
    // fetch data from form
    const email = sanitizeHtml(req.body.email);
    try {
        // check if user already exists
        const checkResult = await db.query("SELECT * FROM subscribers WHERE email = $1", [email]);

        if (checkResult.rows.length > 0) {
            // Send JSON response
            res.status(400).json({ error: 'Email já cadastrado, utilize outro email.' });
        } else {
            // add to database
            const result = await db.query("INSERT INTO subscribers (email) VALUES ($1) RETURNING *", [email]);
            // Send JSON response
            res.json({ success: 'Inscrição realizada com sucesso!' });
        }
    } catch (error) {
        console.log(error);
        // Send JSON response
        res.status(500).json({ error: 'Um erro ocorreu, tente novamente.' });
    }
});


export default router;