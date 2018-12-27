// var path = require('path');
var cookieParser = require('cookie-parser');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var mysql = require('mysql');
var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : '',
	database : 'armchat'
});
 
connection.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  	res.sendFile(__dirname + '/index.html');
});

app.post('/auth', function(req, res) {
	const { login, password } = req.body;

	connection.query('SELECT * FROM users WHERE login=? AND parol=?', [login, password], function (err, users) {
		if (err) throw err;
		if (users.length) {
			const user = users[0];
			const token = String(Math.floor(Math.random() * 6000));

			connection.query('INSERT INTO tokens SET ?', {
				userId: user.id,
				token
			}, function (err) {
				if (err) throw err;

				res.cookie('login', login);
				res.cookie('token', token);
				res.redirect('/chat');
			});
		} else {
			res.redirect('/');
		}
	});
});

app.get('/chat', function(req, res) {
	const { token = '' } = req.cookies;

	connection.query('SELECT users.id, users.login FROM tokens JOIN users ON tokens.userId = users.id WHERE token=?', [token], function (err, users) {
		if (err) throw err;

		if (users.length) {
			res.sendFile(__dirname + '/chat.html');
		} else {
			res.redirect('/');
		}
	});
});

io.on('connection', function (socket) {
	const token = getCookie('token');

	if (!token) {
		socket.disconnect(true);
	}

	connection.query('SELECT * FROM tokens WHERE token=?', [token], function (err, res) {
		if (!res.length) {
			return socket.disconnect(true);
		}
		const userId = res[0].userId;

		connection.query('SELECT login, message FROM messages JOIN users ON messages.userId = users.id', function (err, messages) {
			if (err) throw err;

			socket.emit('chat message', messages);

			socket.on('chat message', function (message) {
				connection.query('INSERT INTO messages SET ?', {
					userId,
					message
				}, function (err) {
					if (err) throw err;

					io.emit('chat message', [{
						login: getCookie('login'),
						message: message
					}]);
				});
			});
		});
	});

	function getCookie(cookiename) {
		// Get name followed by anything except a semicolon
		var cookiestring = RegExp(cookiename+"[^;]+").exec(socket.request.headers.cookie);
		// Return everything after the equal sign, or an empty string if the cookie name not found
		return decodeURIComponent(cookiestring ? cookiestring.toString().replace(/^[^=]+./,"") : "");
	}
});

http.listen(port, function(){
	console.log('listening on *:' + port);
});
