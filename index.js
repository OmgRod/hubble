// Run setup.js to set the ROOT environment variable and set up the database
require('./setup');

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const bodyParser = require("body-parser");
const csurf = require("csurf");
const rateLimit = require('express-rate-limit');
const app = express();

require("dotenv").config();

const port = process.env.PORT || 3000;

// Import routes
const indexRoute = require("./routes/index");
const accountRoute = require("./routes/account");
const searchRoute = require("./routes/search");
const notificationsRoute = require("./routes/notifications");
const settingsRoute = require("./routes/settings");
const userRoute = require("./routes/user");
const apiRoute = require("./routes/api");
const postRoute = require("./routes/post");

// Enable CORS with specific configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type']
}));

// Additional headers middleware
app.use((req, res, next) => {
  res.header('Service-Worker-Allowed', '/');
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Add headers for manifest and service worker
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Service-Worker-Allowed', '/');
  next();
});

// Static files rate limiter
const staticFilesLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // 500 requests per windowMs
  message: 'Too many requests for static files',
  standardHeaders: true,
  legacyHeaders: false
});

// Service worker specific limiter
const swLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many service worker requests'
});

// Manifest file limiter
const manifestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many manifest requests'
});

// Add content-type headers for service worker
app.get('/service-worker.js', swLimiter, (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public/service-worker.js'));
});

// Add headers for manifest
app.get('/manifest.json', manifestLimiter, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, 'public/manifest.json'));
});

// Set view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from the 'public' folder
app.use('/public', staticFilesLimiter);
app.use(express.static(path.join(__dirname, "public")));
app.use("/bootstrap", express.static(path.join(__dirname, "node_modules/bootstrap/dist")));
app.use("/bootstrap-icons/font", express.static(path.join(__dirname, "node_modules/bootstrap-icons/font")));

// Update static file serving
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF protection middleware
app.use(csurf());

// Pass CSRF token to all views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Rate limiter configurations
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per windowMs
  message: 'Too many requests from this account, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.session.userId || req.ip // Use user ID if authenticated, fallback to IP
});

// Apply rate limiting to all routes
app.use(publicLimiter);

// Apply stricter limits to authentication routes
app.use('/account', authLimiter);
app.use('/api', authLimiter);

// Apply different limits to specific routes that need it
app.use('/search', rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50 // 50 requests per 5 minutes
}));

app.use('/post', rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30 // 30 posts per 10 minutes
}));

// Routes
app.use("/", indexRoute);
app.use("/account", accountRoute);
app.use("/search", searchRoute);
app.use("/notifications", notificationsRoute);
app.use("/settings", settingsRoute);
app.use("/user", userRoute);
app.use("/api", apiRoute);
app.use("/post", postRoute);

// Handle 404 errors
app.use((req, res) => {
  res.status(404).render("error", {
    errorCode: 404,
    errorMsg: "Page Not Found"
  });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error for debugging
  res.status(500).render("error", {
    errorCode: 500,
    errorMsg: "Something went wrong. Please try again later."
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
