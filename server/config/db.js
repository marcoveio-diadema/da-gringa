import pg from "pg";

// Create DB
const db = new pg.Pool({
  connectionString: process.env.NODE_ENV === 'production' ? process.env.DB_STRING : 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});


export default db