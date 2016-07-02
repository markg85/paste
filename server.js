var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var server = require('http').Server(app);
var mongoose = require('mongoose');
var path = require('path');
var swig = require('swig');

server.listen(3000);

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
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Set routes
app.get('/', pasteRoutes.pastes);
app.get('/:id?', pasteRoutes.paste);
app.get('/:id/:decryptKey?', pasteRoutes.pasteDecrypt);
app.get('/:id/raw', pasteRoutes.raw);
app.get('/:id/:decryptKey/raw', pasteRoutes.rawDecrypt);
app.post('/', pasteRoutes.create);
