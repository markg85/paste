const express = require("express");
const favicon = require("serve-favicon");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const swig = require("swig-templates");
const multer = require("multer");

const app = express();
// Use http.Server to allow for potential future integrations (e.g., Socket.IO)
const server = require("http").Server(app);

// --- Configuration ---
const PORT = process.env.PORT || 80;
const MONGO_URI = "mongodb://mongo/paste";
const UPLOADS_DIR = path.join(__dirname, "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB
const MAX_BODY_SIZE = "5mb";

// --- Multer Storage Configuration for File Uploads ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Sanitize filename to prevent security risks and prepend timestamp
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${Date.now()}_${safeFilename}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// --- Database Connection ---
mongoose.Promise = global.Promise; // Use native promises
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("connecting", () => console.log("Connecting to MongoDB..."))
  .on("connected", () => console.log("MongoDB connected successfully."))
  .on("reconnected", () => console.log("MongoDB reconnected."))
  .on("disconnected", () => console.log("MongoDB disconnected. Attempting to reconnect..."))
  .on("error", (err) => {
    console.error("MongoDB connection error:", err);
    // Mongoose will attempt to reconnect automatically, so immediate disconnection might not be ideal.
    // mongoose.disconnect();
  })
  .once("open", () => console.log("MongoDB connection opened."));

// --- Template Engine Setup (Swig) ---
app.engine("html", swig.renderFile);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));
swig.setDefaults({
  cache: false, // Set to true in production for performance
});

// --- Middleware ---
app.use(favicon(path.join(__dirname, "public/images/paste_favicon.png")));
app.use(express.static(path.join(__dirname, "public")));
// Parsers for incoming request bodies
app.use(bodyParser.json({ limit: MAX_BODY_SIZE }));
app.use(bodyParser.text({ limit: MAX_BODY_SIZE }));
app.use(bodyParser.urlencoded({ extended: true, limit: MAX_BODY_SIZE }));

// --- Routes ---
const pasteRoutes = require("./routes/pastes");

// File upload and retrieval
app.post("/data", upload.any(), pasteRoutes.uploadData);
app.get("/data/:file", pasteRoutes.getData);

// Page routes
app.get("/", pasteRoutes.pastes);
app.get("/:id", pasteRoutes.paste);
app.get("/:id/raw", pasteRoutes.raw);
app.get("/:id/raw/last", pasteRoutes.rawLast);
app.get("/:id/raw/:nr", pasteRoutes.rawNr);

// Decryption routes
app.get("/:id/:decryptKey", pasteRoutes.pasteDecrypt);
app.get("/:id/:decryptKey/raw", pasteRoutes.rawDecrypt);

// Paste creation routes
app.post("/:parent?", pasteRoutes.create);
app.post("/api/:language", upload.any(), pasteRoutes.createRest);
app.post("/api/:parent/:language", upload.any(), pasteRoutes.createRest);

// --- Error Handling Middleware ---
// This should be the last 'app.use()'
app.use((err, req, res, next) => {
  console.error("An unhandled error occurred:", err);
  // Multer error handling
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  // Generic error response
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.httpStatusCode || 500).json({
    error: err.message || "An internal server error occurred.",
  });
});

// --- Server Start ---
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export app for potential testing or external use
exports.app = app;
