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

// We now use native promises.
mongoose.Promise = global.Promise;

// Create mongoose db connection.
mongoose.connect('mongodb://mongo/paste', { useMongoClient: true }).then(() => {
  console.log("Database connection established.");
  server.listen(80);
  console.log("Server open on port: " + server.address().port);
}).catch(error => {
  console.log("Unable to create database connection.");
});

// Handle various input types
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
