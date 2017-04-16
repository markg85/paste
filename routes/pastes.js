var shortid = require('shortid');
var mongoose = require('mongoose');
var crypto = require('crypto');
var algorithm = 'aes-256-ctr';

var Schema = mongoose.Schema

var lifeTimes = [3600, 14400, 86400, 604800, 1209600, 2419200, 31536000]
    
var pasteSchema = new Schema({
    _id: { type: String, unique: true, 'default': shortid.generate },
    date: { type: Date, default: Date.now },
    language: String,
    lifetime: { type: Number, default: 2419200 },
    encrypted: { type: Boolean, default: true},
    data: String
});

var Paste = mongoose.model('Pastes', pasteSchema);

function encrypt(text){
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    var password = crypto.createHash('sha1').update(current_date + random).digest('hex');
    var cipher = crypto.createCipher(algorithm, password)
    var crypted = cipher.update(text,'utf8','hex')
    crypted += cipher.final('hex');
    
    return {password: password, data: crypted};
}
 
function decrypt(text, password){
  var decipher = crypto.createDecipher(algorithm, password)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

exports.paste = function(req, res){
    var id = req.params.id
    var responseText = "";
  
    if(!id) {
        responseText = "No paste id provided."
    } else {
        mongoose.model("Pastes").findOne({_id: id}, function(err, n){
            if (n) {
                res.render('paste', {title: "Paste", url: n._id, data: n});
            }
        });
    }
};

exports.pasteDecrypt = function(req, res){
    var id = req.params.id
    var responseText = "";
    
    if(!id) {
        responseText = "No paste id provided."
    } else {
        mongoose.model("Pastes").findOne({_id: id}, function(err, n){
            n.data = decrypt(n.data, req.params.decryptKey)
            res.render('paste', {title: "Paste", url: n._id+"/"+req.params.decryptKey, data: n});
        });
    }
};

exports.raw = function(req, res){
    var id = req.params.id
    var responseText = "";
  
    if(id) {
        mongoose.model("Pastes").findOne({_id: id}, function(err, n){
            res.type('text/plain');
            res.send(n.data);
        });
    }
};

exports.rawDecrypt = function(req, res){
    var id = req.params.id
    var responseText = "";
  
    if(id) {
        mongoose.model("Pastes").findOne({_id: id}, function(err, n){
            n.data = decrypt(n.data, req.params.decryptKey)
            res.type('text/plain');
            res.send(n.data);
        });
    }
};

exports.pastes = function(req, res){
    /*
    mongoose.model("Pastes").find(function(err, pastes){
        console.log(err);
        console.log(pastes)
        res.render('index', {title: "Paste service", pasteList: pastes});
    });
    */
    
    res.render('index', {title: "Paste service"});
};

exports.create = function(req, res){
    
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
        res.send({ hash: "", error:"Empty paste received. This is not allowed!" })
        return;
    }
    
    var newPaste;
    if (req.body.language) {
        newPaste = new Paste({ language: req.body.language, data: pasteData, lifetime: req.body.lifetime, encrypted: req.body.encryptPaste });
        newPaste.save(function(err){
                    
                    if(!err) {
                        //console.log("OK...")
                    } else {
                        //console.log(err)
                    }
                    
                });
    }
    res.send({ hash: newPaste._id, decryptKey: decryptKey, error:"none" })
};

exports.createRest = function(req, res){
    var language = req.params.language;
    var lifetime = 0; // unlimited

    if (req.body.data == "") {
        res.send({ hash: "", error:"Empty paste received. This is not allowed!" })
        return;
    }
    
    var newPaste = new Paste({ language: language, data: decodeURIComponent(req.body), lifetime: lifetime, encrypted: false });
    
    newPaste.save(function(err){
      if(!err) {
//        console.log("OK...")
      } else {
//        console.log(err)
      }
    });

    var fullUrl = req.protocol + '://' + req.get('host') + '/' + newPaste._id + '\n';
    res.writeHead(200, {"context-type":"text/plain"});
    res.write(fullUrl);
    res.end();
};
