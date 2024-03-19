import 'dotenv/config';
import express from 'express';
const router = express.Router();
import bodyParser from 'body-parser';
import multer from 'multer';
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import sanitizeHtml from 'sanitize-html';

// import db
import db from '../config/db.js';

// import upload image
import config from '../helpers/functions.js';
const { uploadImage } = config;

// set number of salts
const saltRounds = 10;

// middleware for sessions
router.use(session({
  secret: "something secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}))

// passport middleware
router.use(passport.initialize());
router.use(passport.session());


// Layouts
const adminLayout = '../views/layouts/admin-layout.ejs';

// Body parser
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.static("public"));

// multer storage
const upload = multer({ dest: 'uploads/' });

// GET - Admin page
router.get('/', async (req, res) => {
    try {
        const locals = {
            title: "Admin",
            description: "Simple blog created with NodeJs"
        }        
        res.render("admin/admin-index.ejs", { 
            locals,
        });
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
        res.render("admin/login.ejs", { 
            locals,
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
        res.render("admin/signup.ejs", { 
            locals,
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
router.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}));

// passport local strategy
passport.use(new LocalStrategy(async function verify(username, password, cb) {
try {
    const result = await db.query("SELECT * FROM users WHERE email = $1",[
    username
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

// GET - Create post
router.get('/create-post', async (req, res) => {
    try {
        const locals = {
            title: "Create post",
            description: "Create a new post"
        }        
        res.render("admin/create-post.ejs", { 
            locals,
        });
    } catch (error) {
        console.log(error);
    }
});

export default router;