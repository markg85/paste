var base58 = require('base58');
var mongoose = require('mongoose');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var appDir = path.dirname(require.main.filename);
var algorithm = 'aes-256-ctr';

var Schema = mongoose.Schema

var lifeTimes = [3600, 14400, 86400, 604800, 1209600, 2419200, 31536000]

async function generate(number) {

  let hash = () => {
    let data = ''
    for (let i = 0; i < 5; i++) {
      data += base58.int_to_base58(Math.floor(Math.random() * 58))
    }

    return data;
  };

  let newId = hash();

  // It should not enter this loop more then once.
  // The more pastes are stored, the more likely it enters this loop multiple times.
  for (let i = 0; i < 100; i++) {
    let res = await mongoose.model("Pastes").findOne({
      _id: newId
    });

    if (res == null) {
      break;
    }

    console.log('We had a hash collision here! The more pastes we have the more collisions will occur. If this message happens too often, increase hash length! Loop entry count: ' + i)
  }

  return new Promise((resolve, reject) => {
    resolve(newId)
  });
}

var pasteSchema = new Schema({
  _id: {
    type: String,
    'default': 'hashed'
  },
  date: {
    type: Date,
    default: Date.now
  },
  language: String,
  lifetime: {
    type: Number,
    default: 2419200
  },
  encrypted: {
    type: Boolean,
    default: true
  },
  data: String
});

pasteSchema.pre('save', async function(next) {
  try {
    let newId = await generate();
    this._id = newId;
    return next();
  } catch (e) {
    console.log('Error while pre-saving! Error:')
    console.log(JSON.stringify(e))
    next(e);
  }
});

var Paste = mongoose.model('Pastes', pasteSchema);

function encrypt(text) {
  var current_date = (new Date()).valueOf().toString();
  var random = Math.random().toString();
  var password = crypto.createHash('sha1').update(current_date + random).digest('hex');
  var cipher = crypto.createCipher(algorithm, password)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex');

  return {
    password: password,
    data: crypted
  };
}

function decrypt(text, password) {
  var decipher = crypto.createDecipher(algorithm, password)
  var dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}

exports.paste = (req, res) => {
  var id = req.params.id
  var responseText = "";

  if (!id) {
    responseText = "No paste id provided."
  } else {
    mongoose.model("Pastes").findOne({
      _id: id
    }, function(err, n) {
      if (n) {
        res.render('paste', {
          title: "Paste",
          url: n._id,
          data: n
        });
      } else {
        res.status(404).send("Paste not found.\n");
      }
    });
  }
};

exports.pasteDecrypt = (req, res) => {
  var id = req.params.id
  var responseText = "";

  if (!id) {
    responseText = "No paste id provided."
  } else {
    mongoose.model("Pastes").findOne({
      _id: id
    }, function(err, n) {
      if (n) {
        n.data = decrypt(n.data, req.params.decryptKey)
        res.render('paste', {
          title: "Paste",
          url: n._id + "/" + req.params.decryptKey,
          data: n
        });
      } else {
        res.status(404).send("Paste not found.\n");
      }
    });
  }
};

exports.raw = (req, res) => {
  var id = req.params.id
  var responseText = "";

  if (id) {
    mongoose.model("Pastes").findOne({
      _id: id
    }, function(err, n) {
      if (n) {
        res.type('text/plain');
        res.send(n.data);
      } else {
        res.status(404).send("Paste not found.\n");
      }
    });
  } else {
    res.status(404).send("Paste not found.\n");
  }
};

exports.rawDecrypt = (req, res) => {
  var id = req.params.id
  var responseText = "";

  if (id) {
    mongoose.model("Pastes").findOne({
      _id: id
    }, function(err, n) {
      if (n) {
        n.data = decrypt(n.data, req.params.decryptKey)
        res.type('text/plain');
        res.send(n.data);
      } else {
        res.status(404).send("Paste not found.\n");
      }
    });
  }
};

exports.pastes = (req, res) => {
  /*
  mongoose.model("Pastes").find(function(err, pastes){
      console.log(err);
      console.log(pastes)
      res.render('index', {title: "Paste service", pasteList: pastes});
  });
  */

  res.render('index', {
    title: "Paste service"
  });
};

exports.create = (req, res) => {

  if (req.body.lifetime == 7) {
    req.body.lifetime = 0 // unlimited
  } else if (req.body.lifetime > 6) {
    req.body.lifetime = lifeTimes[5] // 1 month lifetime
  } else {
    req.body.lifetime = lifeTimes[req.body.lifetime]
  }

  // Weird.. the "encryptPaste" value is a string, not a bool.. It does contain only "true" or "false" so just parsing it fixes it.
  req.body.encryptPaste = JSON.parse(req.body.encryptPaste)

  var pasteData = req.body.data;
  var decryptKey = "";

  if (req.body.encryptPaste) {
    var encryptResult = encrypt(pasteData);
    pasteData = encryptResult.data;
    decryptKey = encryptResult.password;
  }

  if (req.body.data == "") {
    res.send({
      hash: "",
      error: "Empty paste received. This is not allowed!"
    })
    return;
  }

  var newPaste;
  if (req.body.language) {
    newPaste = new Paste({
      language: req.body.language,
      data: pasteData,
      lifetime: req.body.lifetime,
      encrypted: req.body.encryptPaste
    });
    newPaste.save(function(err) {

      if (!err) {
        res.send({
          hash: newPaste._id,
          decryptKey: decryptKey,
          error: "none"
        })
      } else {
        res.status(404).send("Error while storing paste in database.\n")
        console.log(err)
      }
    });
  }
};

exports.uploadData = (req, res) => {
  var fullUrl = 'https://' + req.get('host') + '/data/' + req.files[0].filename + '\n';
  res.writeHead(200, {
    "context-type": "text/plain"
  });
  res.write(fullUrl);
  res.end();
}

exports.getData = (req, res) => {
  var file = req.params.file;

  if (file == "") {
    res.status(404).send("No valid input given.\n")
    return;
  }

  var fullFile = appDir + '/uploads/' + file
  res.download(fullFile, function(err) {
    if (err) {
      console.log("File download error:");
      console.log(err);
    }
  });
}

exports.createRest = (req, res) => {
  var language = req.params.language;
  var lifetime = 0; // unlimited

  if (req.body.data == "") {
    res.send({
      hash: "",
      error: "Empty paste received. This is not allowed!"
    })
    return;
  }

  var newPaste = new Paste({
    language: language,
    data: req.body,
    lifetime: lifetime,
    encrypted: false
  });

  newPaste.save(function(err) {
    if (!err) {
      var fullUrl = req.protocol + '://' + req.get('host') + '/' + newPaste._id;
      res.json({
        id: newPaste._id,
        url: fullUrl
      });
    } else {
      console.log(err)
    }
  });

};
