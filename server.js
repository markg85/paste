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

// Handle JSON input
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

// API routes.
app.use('/api', require('./routes/pastes'));
