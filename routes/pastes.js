const mongoose = require("mongoose");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const appDir = path.dirname(require.main.filename);

// --- Constants ---
// Modern, secure algorithm. Requires a 16-byte IV.
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
// Lifetimes in seconds
const lifeTimes = {
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
  "2w": 1209600,
  "1m": 2419200,
  "1y": 31536000,
  inf: 0,
};

// --- Schema Definition ---
const pasteSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  parent: {
    type: String,
    default: "",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  language: String,
  lifetime: {
    type: Number,
    default: lifeTimes["1m"], // Default to 1 month
  },
  encrypted: {
    type: Boolean,
    default: false,
  },
  // Data is stored as 'iv:encryptedData' if encrypted
  data: String,
});

// --- Model Middleware ---
// Use a pre-validation hook to generate the ID, ensuring it exists before saving.
pasteSchema.pre("validate", async function (next) {
  if (this.isNew) {
    try {
      this._id = await generateUniqueId();
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const Paste = mongoose.model("Pastes", pasteSchema);

// --- Helper Functions ---
/**
 * Generates a short, unique, URL-friendly ID.
 * Retries if a collision is detected.
 */
async function generateUniqueId(length = 5) {
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
  let newId;

  for (let i = 0; i < 10; i++) {
    // Limit retries to prevent infinite loops
    newId = "";
    for (let j = 0; j < length; j++) {
      newId += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    const existing = await Paste.findOne({ _id: newId }).lean();
    if (!existing) {
      return newId; // ID is unique
    }
    console.log(`Hash collision for ID: ${newId}. Retrying...`);
  }

  // If we exit the loop, it means we failed to generate a unique ID after several tries.
  throw new Error("Failed to generate a unique ID after multiple attempts. Increase hash length.");
}

/**
 * Encrypts text using aes-256-cbc.
 * Returns an object with the encryption key (password) and the iv:encrypted_data string.
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const password = crypto.randomBytes(32).toString("hex"); // Generate a secure, random key
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(password, "hex"), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    password: password,
    data: `${iv.toString("hex")}:${encrypted}`, // Store IV with data
  };
}

/**
 * Decrypts an 'iv:encryptedData' string.
 */
function decrypt(text, password) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = textParts.join(":");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(password, "hex"), iv);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return "DECRYPTION FAILED: Invalid key or corrupted data.";
  }
}

// --- Route Handlers ---

exports.paste = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send("No paste ID provided.");
    }
    const results = await Paste.find({ $or: [{ _id: id }, { parent: id }] })
      .sort({ date: -1 })
      .lean();

    if (results.length === 0) {
      return res.status(404).send("Paste not found.");
    }

    res.render("paste", { title: "Paste", data: results });
  } catch (err) {
    console.error(`Error in 'paste' handler:`, err);
    res.status(404).send("Paste not found or error occurred.");
  }
};

exports.pasteDecrypt = async (req, res) => {
  try {
    const { id, decryptKey } = req.params;
    if (!id || !decryptKey) {
      return res.status(400).send("Paste ID and decryption key are required.");
    }

    const results = await Paste.find({ $or: [{ _id: id }, { parent: id }] })
      .sort({ date: -1 })
      .lean();

    if (results.length === 0) {
      return res.status(404).send("Paste not found.");
    }

    // Decrypt data for each paste before rendering
    const decryptedResults = results.map((paste) => ({
      ...paste,
      data: paste.encrypted ? decrypt(paste.data, decryptKey) : "This paste is not encrypted.",
    }));

    res.render("paste", {
      title: "Paste (Decrypted)",
      url: `${id}/${decryptKey}`,
      data: decryptedResults,
    });
  } catch (err) {
    console.error(`Error in 'pasteDecrypt' handler:`, err);
    res.status(404).send("Paste not found or decryption failed.");
  }
};

exports.raw = async (req, res) => {
  try {
    const paste = await Paste.findOne({ _id: req.params.id }).lean();
    res.type("text/plain");
    if (paste) {
      if (paste.encrypted) {
        return res.status(403).send("This paste is encrypted. Use the /:id/:decryptKey/raw endpoint to view it.");
      }
      res.send(paste.data);
    } else {
      res.status(404).send("Paste not found.");
    }
  } catch (err) {
    res.status(404).send("Paste not found.");
  }
};

exports.rawNr = async (req, res) => {
  try {
    const { id, nr } = req.params;
    const results = await Paste.find({ $or: [{ _id: id }, { parent: id }] })
      .sort({ date: -1 })
      .lean();

    const index = parseInt(nr, 10);
    if (results.length > index) {
      const paste = results[index];
      res.type("text/plain");
      if (paste.encrypted) {
        return res.status(403).send("This paste is encrypted. Use the /:id/:decryptKey/raw endpoint to view it.");
      }
      res.send(paste.data);
    } else {
      res.status(404).send(`Paste with index ${nr} not found for ID ${id}.`);
    }
  } catch (err) {
    res.status(404).send("Paste not found.");
  }
};

exports.rawLast = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Paste.findOne({ $or: [{ _id: id }, { parent: id }] })
      .sort({ date: -1 })
      .lean();

    if (result) {
      res.type("text/plain");
      if (result.encrypted) {
        return res.status(403).send("This paste is encrypted. Use the /:id/:decryptKey/raw endpoint to view it.");
      }
      res.send(result.data);
    } else {
      res.status(404).send(`No pastes found for ${id}.`);
    }
  } catch (err) {
    res.status(404).send("Paste not found.");
  }
};

exports.rawDecrypt = async (req, res) => {
  try {
    const { id, decryptKey } = req.params;
    const paste = await Paste.findOne({ _id: id }).lean();

    if (paste) {
      res.type("text/plain");
      const decryptedData = decrypt(paste.data, decryptKey);
      res.send(decryptedData);
    } else {
      res.status(404).send("Paste not found.");
    }
  } catch (err) {
    res.status(404).send("Paste not found or decryption failed.");
  }
};

exports.pastes = (req, res) => {
  res.render("index", { title: "Paste Service" });
};

exports.create = async (req, res) => {
  try {
    if (!req.body.data) {
      return res.status(400).json({ error: "Empty paste received. This is not allowed!" });
    }

    let pasteData = req.body.data;
    let decryptKey = "";
    const isEncrypted = req.body.encryptPaste === "true" || req.body.encryptPaste === true;

    if (isEncrypted) {
      const encryptResult = encrypt(pasteData);
      pasteData = encryptResult.data;
      decryptKey = encryptResult.password;
    }

    const lifetimeKey = req.body.lifetime || "1m"; // Default lifetime
    const lifetimeValue = lifeTimes[lifetimeKey] ?? lifeTimes["1m"];

    const newPaste = new Paste({
      parent: req.params.parent || "",
      language: req.body.language,
      data: pasteData,
      lifetime: lifetimeValue,
      encrypted: isEncrypted,
    });

    await newPaste.save();

    const returnId = newPaste.parent || newPaste._id;
    res.status(201).json({
      hash: returnId,
      decryptKey: decryptKey || "none", // Send back the key if created
      error: "none",
    });
  } catch (error) {
    console.error("Error creating paste:", error);
    res.status(500).json({ error: "Error while storing paste in database." });
  }
};

exports.createRest = async (req, res) => {
  try {
    // Expects raw text from 'body-parser.text' middleware
    const data = req.body;
    if (typeof data !== "string" || !data.trim()) {
      return res.status(400).json({ error: "Empty or invalid paste data received. This is not allowed!" });
    }

    const newPaste = new Paste({
      parent: req.params.parent || "",
      language: req.params.language,
      data: data,
      lifetime: lifeTimes["inf"], // Unlimited
      encrypted: false,
    });

    await newPaste.save();

    const fullUrl = `${req.protocol}://${req.get("host")}/${newPaste._id}`;
    res.status(201).json({
      id: newPaste._id,
      url: fullUrl,
    });
  } catch (error) {
    console.error("Error in createRest:", error);
    res.status(500).json({ error: "Error while storing paste in database." });
  }
};

exports.uploadData = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("No file uploaded.");
  }
  const fileUrl = `${req.protocol}://${req.get("host")}/data/${req.files[0].filename}`;
  // Corrected the header from 'context-type' to 'Content-Type'
  res.status(201).header("Content-Type", "text/plain").send(fileUrl);
};

exports.getData = (req, res, next) => {
  const { file } = req.params;

  if (!file) {
    return res.status(400).send("No valid file specified.");
  }

  // --- SECURITY FIX: Path Traversal ---
  // 1. Define the absolute path for the uploads directory.
  const uploadsDir = path.join(appDir, "uploads");
  // 2. Join the requested filename to the uploads directory path.
  //    path.join normalizes the path, helping to prevent '..' tricks.
  const requestedPath = path.join(uploadsDir, file);
  // 3. Check if the resolved path is still inside the uploads directory.
  //    This is the crucial step that prevents accessing parent directories.
  if (!requestedPath.startsWith(uploadsDir)) {
    return res.status(403).send("Forbidden: Access to this file is not allowed.");
  }

  res.download(requestedPath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).send("File not found.");
      }
      // Pass other errors to the central error handler in server.js
      return next(err);
    }
  });
};
