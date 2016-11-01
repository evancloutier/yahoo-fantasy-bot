var mongoose = require('mongoose');
var db = mongoose.connection;

// initializing our database
mongoose.connect('mongodb://localhost/fantasybot');

// error handler
db.on('error', function(err) {
	console.log(err);
});

// reconnect when closed
db.on('disconnected', function() {
	connect();
});

db.once('open', function () {
	console.log("Success! Connected to the database!");
});