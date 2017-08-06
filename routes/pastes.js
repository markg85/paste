let shortid = require('shortid');
let mongoose = require('mongoose');
let crypto = require('crypto');
let path = require('path');
let appDir = path.dirname(require.main.filename);
let algorithm = 'aes-256-ctr';
let express = require('express');
let router = express.Router();


let Schema = mongoose.Schema

let lifeTimes = [3600, 14400, 86400, 604800, 1209600, 2419200, 31536000]

let pasteSchema = new Schema({
  _id: { type: String, unique: true, 'default': shortid.generate },
  date: { type: Date, default: Date.now },
  language: String,
  lifetime: { type: Number, default: 2419200 },
  encrypted: { type: Boolean, default: true},
  data: String
});

let Paste = mongoose.model('Pastes', pasteSchema);

function encrypt(text){
  let current_date = (new Date()).valueOf().toString();
  let random = Math.random().toString();
  let password = crypto.createHash('sha1').update(current_date + random).digest('hex');
  let cipher = crypto.createCipher(algorithm, password)
  let crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');

  return {password: password, data: crypted};
}

function decrypt(text, password){
  let decipher = crypto.createDecipher(algorithm, password)
  let dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

let emptyPaste = {
  lifetime: 0,
  language: "cpp",
  encrypted: false,
  data: ""
}

function objectValidation(object) {
  // Lifetime
  if (object.lifetime < 0 || object.lifetime > lifeTimes.length) {
    console.log("The provided lifetime is of an invalid number.");
    return false;
  }

  if (typeof(object.encrypted) != "boolean") {
    console.log("The encrypted type is not a boolean!");
    return false;
  }

  // TODO: check for the actual allowed types...
  if (typeof(object.language) != "string") {
    console.log("The language is not a string!");
    return false;
  }

  if (typeof(object.data) != "string") {
    console.log("The data is not a string!");
    return false;
  }

  if (object.data.length < 3) {
    console.log("The data needs to be at least 3 characters long!");
    return false;
  }

  return true;
}

function createPaste(inputData) {
  let copy = Object.assign({}, emptyPaste, inputData);

  if (!objectValidation(copy)) {
    console.log("Aborting paste creation. There is invalid data!");
    return Promise.reject(new Error('Aborting paste creation. There is invalid data!'));
  }

  return Paste(copy).save();
}

// Handle file logic.
router.param('id', (req, res, next, id) => {
  if (!id) {
    res.status(500).json({ error: "No valid ID provided." });
  }

  mongoose.model("Pastes").findOne({_id: id}, function(err, n){
    if (n) {
      req.idFromDb = n;
      next();
    } else {
      res.status(404).json({ error: "Paste not found." });
    }
  });
});

router.get('/:id', (req, res) => {
  console.log("..paste");
  res.json(req.idFromDb);
});

router.get('/:id/:decryptKey?', (req, res) => {
  console.log("..pasteDecrypt");
  req.idFromDb.data = decrypt(req.idFromDb.data, req.params.decryptKey)
  res.json(req.idFromDb);
});

router.get('/:id/raw', (req, res) => {
  console.log("..raw")
  res.json(req.idFromDb);
});

router.get('/:id/:decryptKey/raw', (req, res) => {
  console.log("..rawDecrypt")
  req.idFromDb.data = decrypt(req.idFromDb.data, req.params.decryptKey)
  res.json(req.idFromDb);
});

router.post('/', (req, res) => {
  console.log("..create");
  if (req.body.lifetime == 7) {
    req.body.lifetime = 0 // unlimited
  } else if (req.body.lifetime > 6) {
    req.body.lifetime = lifeTimes[5] // 1 month lifetime
  } else {
    req.body.lifetime = lifeTimes[req.body.lifetime]
  }

  if (typeof req.body.encryptPaste == 'undefined') {
    res.status(500).json({ error: "There is data missing in the headers and/or body of your request!" });
    return;
  }

  // Weird.. the "encryptPaste" value is a string, not a bool.. It does contain only "true" or "false" so just parsing it fixes it.
  req.body.encryptPaste = JSON.parse(req.body.encryptPaste)

  let pasteData = req.body.data;
  let decryptKey = "";

  if (req.body.encryptPaste) {
    let encryptResult = encrypt(pasteData);
    pasteData = encryptResult.data;
    decryptKey = encryptResult.password;
  }

  let pasteDataObj = {
    lifetime: req.body.lifetime,
    language: req.body.language,
    encrypted: req.body.encryptedPaste,
    data: pasteData
  }

  createPaste(pasteDataObj).then((obj) => {
    res.json({ hash: obj._id, decryptKey: decryptKey })
  }).catch((error) => {
    res.status(500).json({ error: error })
  });
});

router.post('/data', (req, res) => {
  console.log("..uploadData")
  let fullUrl = req.protocol + '://' + req.get('host') + '/data/' + req.files[0].filename;
  res.json({ url: fullUrl });
});

// Handle file logic.
router.param('file', (req, res, next, file) => {
  if (file == "") {
    res.status(404).json({ error: "No valid input given." })
  }

  try {
    fs.accessSync(appDir + '/uploads/' + file);
    next();
  } catch (e) {
    res.status(404).json({ error: "File not found on server. Its probably deleted or never uploaded." });
  }
});

router.get('/data/:file', (req, res) => {
  console.log("..getData")
  res.sendFile(appDir + '/uploads/' + file);
});

router.post('/:language', (req, res) => {
  console.log("..createRest")

  let pasteDataObj = {
    lifetime: 0,
    language: req.params.language,
    encrypted: false,
    data: req.body
  }

  createPaste(pasteDataObj).then((obj) => {
    let fullUrl = req.protocol + '://' + req.get('host') + '/' + obj._id;
    res.json({ id: obj._id, url: fullUrl });
  }).catch((error) => {
    res.status(500).json({ error: error })
  });
});

router.all('*', (req, res) => {
  res.status(404).json({ error: "This route does not exist!" });
});

module.exports = router;
