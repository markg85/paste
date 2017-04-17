var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var server = require('http').Server(app);
var mongoose = require('mongoose');
var path = require('path');
var swig = require('swig');
var multer = require('multer');

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '_' + file.originalname)
  }
})

var upload = multer({storage: storage});

server.listen(3010);

// Database connection
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log("database connection is open!")
});

mongoose.connect('mongodb://localhost/paste');

swig.setDefaults({ cache: false });

var pasteRoutes = require('./routes/pastes');
exports.app = app

app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Set routes
app.get('/', pasteRoutes.pastes);

// Upload for data
app.get('/data/:file', pasteRoutes.getData);

app.get('/:id?', pasteRoutes.paste);
app.get('/:id/raw', pasteRoutes.raw);
app.get('/:id/:decryptKey?', pasteRoutes.pasteDecrypt);
app.get('/:id/:decryptKey/raw', pasteRoutes.rawDecrypt);
app.post('/', pasteRoutes.create);

app.post('/data', upload.any(), pasteRoutes.uploadData);

// Create a paste where the language is in the url. All the data is.. well.. in the data.
// This does prevent provinding options like lifetime, but on the other hand opens the door to easily paste from the command line using curl.
app.post('/:language', upload.any(), pasteRoutes.createRest);
