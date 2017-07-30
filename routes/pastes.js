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

router.post('/', (req, rs) => {
  console.log("..create");
  if (req.body.lifetime == 7) {
    req.body.lifetime = 0 // unlimited
  } else if (req.body.lifetime > 6) {
    req.body.lifetime = lifeTimes[5] // 1 month lifetime
  } else {
    req.body.lifetime = lifeTimes[req.body.lifetime]
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

  if (req.body.data == "") {
    res.status(500).json({ error: "Empty paste received. This is not allowed!" })
    return;
  }

  let newPaste;
  if (req.body.language) {
    newPaste = new Paste({ language: req.body.language, data: pasteData, lifetime: req.body.lifetime, encrypted: req.body.encryptPaste });

    newPaste.save(function(err){
      if(err) {
        res.status(500).json({ error: err });
      }
    });
    res.json({ hash: newPaste._id, decryptKey: decryptKey })
  } else {
    res.status(500).json({ error: "You cannot paste without providing at least the language you want to paste in!" })
  }
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
  let language = req.params.language;
  let lifetime = 0; // unlimited

  if (req.body.data == "") {
    res.json({ hash: "", error:"Empty paste received. This is not allowed!" })
    return;
  }

  let newPaste = new Paste({ language: language, data: req.body, lifetime: lifetime, encrypted: false });

  newPaste.save(function(err){
    if(err) {
      res.status(500).json({ error: err });
    } else {
      let fullUrl = req.protocol + '://' + req.get('host') + '/' + newPaste._id;
      res.json({ id: newPaste._id, url: fullUrl });
    }
  });
});

router.all('*', (req, res) => {
  res.status(404).json({ error: "This route does not exist!" });
});

module.exports = router;
