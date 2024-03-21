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

        // Redirect to the login page
        res.redirect('/user/login');
    } catch (error) {
        console.log(error);
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
        });
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
        });
    } catch (error) {
        console.log(error);
    }
});

// POST - signup
router.post("/signup", upload.single('profilePicture'), async (req, res) => {
    // get data from form
    const profilePicture = await uploadImage(req.file, 'profile/');
    const firstName = sanitizeHtml(req.body.firstName);
    const lastName = sanitizeHtml(req.body.lastName);
    const email = sanitizeHtml(req.body.email);
    const username = sanitizeHtml(req.body.username);
    const password = sanitizeHtml(req.body.password);
    const confirmPassword = sanitizeHtml(req.body.confirmPassword);
    const userBio = sanitizeHtml(req.body.userBio);


    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).send("Passwords do not match");
    }

    try {
        // check if user already exists
      const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]
      );
        // if user already exists
      if (checkResult.rows.length > 0) {
        res.send("User already exists, try logging in.");
      } else {
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
            req.login(user, (err) => {
              if (err) {
                console.log("Error logging in", err);
              } else {
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

// POST - login
router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) { 
            return next(err); 
        }
        if (!user) { 
            return res.redirect('/user/login'); 
        }
        req.logIn(user, (err) => {
            if (err) { 
                return next(err); 
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
            return cb(null, false);
            }
        }
        });

        } else {
        return cb("user not found");}
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



export default router;