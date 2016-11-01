const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let userSchema = new Schema({
	// authentication specific data
	fb_id: String,
	yahoo_guid: String,
	oauth_token: String,
	oauth_token_secret: String,
	oauth_verifier: String,
	oauth_session_handle: String,
	creation_time: String,

	// yahoo specific data
	games: [{ 	game: [{	name: String,
							game_key: String, 
							season: String,
							teams: [{ 	name: String,
										team_key: String,
										league_key: String 	}] 	}] 	}]
});

let User = mongoose.model('User', userSchema);

module.exports = User;