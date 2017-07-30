let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let server = require('http').Server(app);
let mongoose = require('mongoose');
let path = require('path');
let multer = require('multer');

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '_' + file.originalname)
  }
})

let upload = multer({storage: storage, limits: {fileSize: 10485760}}); // 10 MiB limit

server.listen(80);

// Database connection
let db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log("database connection is open!")
});

// We now use native promises.
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://mongo/paste', {
  useMongoClient: true
});

exports.app = app

app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Allow remote origin. Makes AJAX requests for sites easier.
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Load routes
let pasteRoutes = require('./routes/pastes');

// Upload for data
app.get('/data/:file', pasteRoutes.getData);

app.get('/:id', pasteRoutes.paste);
app.get('/:id/raw', pasteRoutes.raw);
app.get('/:id/:decryptKey?', pasteRoutes.pasteDecrypt);
app.get('/:id/:decryptKey/raw', pasteRoutes.rawDecrypt);
app.post('/', pasteRoutes.create);

app.post('/data', upload.any(), pasteRoutes.uploadData);

// Create a paste where the language is in the url. All the data is.. well.. in the data.
// This does prevent provinding options like lifetime, but on the other hand opens the door to easily paste from the command line using curl.
app.post('/:language', upload.any(), pasteRoutes.createRest);

// Default fallback routes.
app.get('*', pasteRoutes.fallback);
app.post('*', pasteRoutes.fallback);
