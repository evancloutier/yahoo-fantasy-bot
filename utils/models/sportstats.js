const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let sportStatsSchema = new Schema({
	baseball: 	[{ 	stat_id: String,
					stat_name: String,
					stat_abrv: String }],
	basketball: [{ 	stat_id: String,
					stat_name: String,
					stat_abrv: String }],
	football: 	[{ 	stat_id: String,
					stat_name: String,
					stat_abrv: String }],
	hockey: 	[{ 	stat_id: String,
					stat_name: String,
					stat_abrv: String }]
});

let SportStats = mongoose.model('sportStats', sportStatsSchema);

module.exports = SportStats;