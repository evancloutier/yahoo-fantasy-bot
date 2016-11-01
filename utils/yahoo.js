const fs = require('fs');
const mongoose = require('mongoose');
const parser = require('xml2json');
const request = require('request');

const Mongo = require('./models/mongo');
const SportStats = require('./models/sportstats');
const User = require('./models/user');
const authentication = require('./authentication');

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const redirectUri = process.env.REDIRECT_URI;

exports.checkCurrentSeason = (sport, season) => {
	let currentDate = new Date();
	let currentMonth = currentDate.getMonth() + 1;
	let currentYear = currentDate.getFullYear();

	if (sport == "baseball") {
		if (currentYear == season)
			return true;
		else
			return false;
	} else if (sport == "basketball") {
		if ((currentYear == (parseInt(season) + 1) && currentMonth < 9) || (currentYear == season && currentMonth >= 9))
			return true;
		else
			return false;
	} else if (sport == "football") {
		if ((currentYear == (parseInt(season) + 1) && currentMonth < 8) || (currentYear == season && currentMonth >= 8))
			return true;
		else
			return false;
	} else if (sport == "hockey") {
		if ((currentYear == (parseInt(season) + 1) && currentMonth < 9) || (currentYear == season && currentMonth >= 9))
			return true;
		else
			return false;
	}
}

exports.getTeamCount = (fb_id, sport) => {
	return new Promise((resolve, reject) => {
		authentication.checkRefresh(fb_id).then((result) => {
			console.log("Getting team count...");
			if (result == true) {
				User.findOne({ fb_id: fb_id }, (error, result) => {
					if (error)
						return reject(error);

					const gameData = result.games[0].game;
					let teamCount = 0;

					for  (const gameObject in gameData) {
						if (!isNaN(parseInt(gameObject))) {
							if (gameData[gameObject].name.toLowerCase() == sport.toLowerCase()) {
								const teamData = gameData[gameObject].teams;
								for (const teamObject in teamData) {
									if (!isNaN(parseInt(teamObject))) {
										teamCount += 1;
									}
								}
							}
						}
					}

					console.log(sport + " team count: " + teamCount);
					return resolve(teamCount);
				});
			}
		});
	});
}

exports.getTeams = (fb_id, sport) => {
	return new Promise((resolve, reject) => {
		console.log("Retrieving teams...");
		authentication.checkRefresh(fb_id).then((result) => {
			if (result == true) {
				User.findOne({ fb_id: fb_id }, (error, result) => {
					if (error)
						return reject(error);

					const gameData = result.games[0].game;
					let teamArray = [];
					let teamObject = {};

					for (const gameObject in gameData) {
						if (!isNaN(parseInt(gameObject))) {
							if (gameData[gameObject].name.toLowerCase() == sport.toLowerCase()) {
								teamObject.sport = gameData[gameObject].name;
								const teamData = gameData[gameObject].teams;
								for (const teamObject in teamData) {
									if (!isNaN(parseInt(teamObject))) {
										teamArray.push(teamData[teamObject].name);
									}
								}
							}
						}
					}

					teamObject.teams = teamArray;
					return resolve(teamObject);
				});
			}
		});
	});
}

exports.getLineup = (userObject) => {
	return new Promise((resolve, reject) => {
		console.log("Getting lineup...");
		authentication.checkRefresh(userObject.fbid).then((result) => {
			if (result == true) {
				User.findOne({ fb_id: userObject.fbid }, (error, result) => {
					if (error)
						return reject(error);

					let teamKey = "";
					if (userObject.context.hasOwnProperty("singleLeague")) {
						const gameData = result.games[0].game;
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											teamKey = teamData[teamObject].team_key;
										}
									}
								}
							}
						}
					} else if (userObject.context.hasOwnProperty("multipleLeagues")) {
						const gameData = result.games[0].game;
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											if (teamData[teamObject].name == userObject.context.team) {
												teamKey = teamData[teamObject].team_key;
											}
										}
									}
								}
							}
						}
					}

					const url = "http://fantasysports.yahooapis.com/fantasy/v2/team/" + teamKey + "/roster/players";
					const oauth = {
						consumer_key: consumerKey,
						consumer_secret: consumerSecret,
						token: result.oauth_token,
						token_secret: result.oauth_token_secret,
						verifier: result.oauth_verifier
					};

					request.get({ url: url, oauth: oauth }, (error, response, body) => {
						// TO-DO: handle errors from yahoo response
						if (error)
							return reject(error);

						const responseData = JSON.parse(parser.toJson(body));
						const playerData = responseData.fantasy_content.team.roster.players.player;
						let resultStrings = {};

						if (userObject.context.sport == "baseball") {
							let offenseString = "";
							let pitcherString = "";
							let benchString = "";

							for (const playerObject in playerData) {
								if (pitcherString == "" && (playerData[playerObject].selected_position.position == "SP" || playerData[playerObject].selected_position.position == "P" || playerData[playerObject].selected_position.position == "RP")) {
									pitcherString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
									if (playerData[playerObject].hasOwnProperty("starting_status") && playerData[playerObject].starting_status.is_starting == "1")
										pitcherString += "*"
								} else if (playerData[playerObject].selected_position.position == "SP" || playerData[playerObject].selected_position.position == "P" || playerData[playerObject].selected_position.position == "RP") {
									pitcherString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
									if (playerData[playerObject].hasOwnProperty("starting_status") && playerData[playerObject].starting_status.is_starting == "1")
										pitcherString += "*"
								} else if (benchString == "" && playerData[playerObject].selected_position.position == "BN") {
									benchString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
									if (playerData[playerObject].hasOwnProperty("starting_status") && playerData[playerObject].starting_status.is_starting == "1")
										benchString += "*"
								} else if (playerData[playerObject].selected_position.position == "BN") {
									benchString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
									if (playerData[playerObject].hasOwnProperty("starting_status") && playerData[playerObject].starting_status.is_starting == "1")
										benchString += "*"
								} else if (offenseString == "") {
									offenseString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
									if (playerData[playerObject].hasOwnProperty("starting_status") && playerData[playerObject].starting_status.is_starting == "1")
										offenseString += "*"
								} else {
									offenseString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
									if (playerData[playerObject].hasOwnProperty("starting_status") && playerData[playerObject].starting_status.is_starting == "1")
										offenseString += "*"
								}
							}

							resultStrings = {
								offense: offenseString,
								pitchers: pitcherString,
								bench: benchString
							};
						} else if (userObject.context.sport == "basketball") {
							let offenseString = "";
							let benchString = "";

							for (const playerObject in playerData) {
								if (benchString == "" && playerData[playerObject].selected_position.position == "BN") {
									benchString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
								} else if (playerData[playerObject].selected_position.position == "BN") {
									benchString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
								} else if (offenseString == "") {
									offenseString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
								} else {
									offenseString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
								}
							}

							resultStrings = {
								offense: offenseString,
								bench: benchString
							};
						} else if (userObject.context.sport == "football") {
							let offenseString = "";
							let benchString = "";

							for (const playerObject in playerData) {
								if (benchString == "" && playerData[playerObject].selected_position.position == "BN") {
									benchString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
									if (playerData[playerObject].bye_weeks.week != playerData[playerObject].selected_position.week)
										benchString += "*"
								} else if (playerData[playerObject].selected_position.position == "BN") {
									benchString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
									if (playerData[playerObject].bye_weeks.week != playerData[playerObject].selected_position.week)
										benchString += "*"
								} else if (offenseString == "") {
									offenseString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
									if (playerData[playerObject].bye_weeks.week != playerData[playerObject].selected_position.week)
										offenseString += "*"
								} else {
									offenseString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
									if (playerData[playerObject].bye_weeks.week != playerData[playerObject].selected_position.week)
										offenseString += "*"
								}
							}

							resultStrings = {
								offense: offenseString,
								bench: benchString
							};
						
						} else if (userObject.context.sport == "hockey") {
							let offenseString = "";
							let defenseString = "";
							let benchString = "";

							for (const playerObject in playerData) {
								if (benchString == "" && playerData[playerObject].selected_position.position == "BN")
									benchString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
								else if (playerData[playerObject].selected_position.position == "BN")
									benchString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr + " (" + playerData[playerObject].display_position + ")";
								else if (offenseString == "" && (playerData[playerObject].selected_position.position == "C" || playerData[playerObject].selected_position.position == "RW" || playerData[playerObject].selected_position.position == "LW" || playerData[playerObject].selected_position.position == "F"))
									offenseString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
								else if (playerData[playerObject].selected_position.position == "C" || playerData[playerObject].selected_position.position == "RW" || playerData[playerObject].selected_position.position == "LW" || playerData[playerObject].selected_position.position == "F")
									offenseString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
								else if (defenseString == "")
									defenseString = playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
								else
									defenseString += "\n" + playerData[playerObject].selected_position.position + ": " + playerData[playerObject].name.full + ", " + playerData[playerObject].editorial_team_abbr;
							}

							resultStrings = {
								offense: offenseString,
								defense: defenseString,
								bench: benchString
							};
						}

						return resolve(resultStrings);
					});
				});
			}
		});
	});
}

exports.getMatchup = (userObject) => {
	return new Promise((resolve, reject) => {
		authentication.checkRefresh(userObject.fbid).then((result) => {
			if (result == true) {
				User.findOne({ fb_id: userObject.fbid }, (error, result) => {
					if (error)
						return reject(error);

					const gameData = result.games[0].game;
					let leagueKey = "";
					let teamName = "";
					if (userObject.context.hasOwnProperty("singleLeague")) {
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											teamKey = teamData[teamObject].team_key;
											teamName = teamData[teamObject].name;
											leagueKey = teamData[teamObject].league_key;
										}
									}
								}
							}
						}
					} else if (userObject.context.hasOwnProperty("multipleLeagues")) {
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											if (teamData[teamObject].name == userObject.context.team) {
												teamKey = teamData[teamObject].team_key;
												teamName = teamData[teamObject].name;
												leagueKey = teamData[teamObject].league_key
											}
										}
									}
								}
							}
						}
					}

					const url = "http://fantasysports.yahooapis.com/fantasy/v2/league/" + leagueKey + "/scoreboard";
					const oauth = {
						consumer_key: consumerKey,
						consumer_secret: consumerSecret,
						token: result.oauth_token,
						token_secret: result.oauth_token_secret,
						verifier: result.oauth_verifier
					};

					request.get({ url: url, oauth: oauth }, (error, response, body) => {
						if (error)
							return reject(error);

						// TO-DO: Handle proper data parsing for playoff situations - check the logged in user's team
						const responseData = JSON.parse(parser.toJson(body));
						const matchupData = responseData.fantasy_content.league.scoreboard.matchups.matchup;

						let matchupString = "";
						let statString = "";
						let finalString = "";

						getSportStats(userObject.context.sport).then((sportStats) => {
							for (const matchup in matchupData) {
								const teamData = matchupData[matchup].teams.team;

								for (const team in teamData) {
									if (teamData[team].name == teamName && team == 0) {
										if (userObject.context.sport == "football") {
											matchupString = "Week " + matchupData[matchup].week + " Matchup\n\n" + teamName + " vs. " + teamData[parseInt(team) + 1].name + "\n";
											matchupString += "PTS: " + teamData[team].team_points.total + " <-> " + teamData[parseInt(team) + 1].team_points.total + "\n\n";
										} else {
											matchupString = "Week " + matchupData[matchup].week + " Matchup\n\n" + teamName + " vs. " + teamData[parseInt(team) + 1].name + "\n";
											matchupString += "PTS: " + teamData[team].team_points.total + " <-> " + teamData[parseInt(team) + 1].team_points.total + "\n\n";

											const userStatData = teamData[team].team_stats.stats.stat;
											const opponentStatData = teamData[parseInt(team) + 1].team_stats.stats.stat;

											for (const stat in userStatData) {
												const stat_id = userStatData[stat].stat_id;
												if (sportStats.hasOwnProperty(stat_id)) {
													const userValue = userStatData[stat].value;
													const opponentValue = opponentStatData[stat].value;

													if (statString == "")
														statString = sportStats[stat_id].stat_abrv + ": " + userValue + " - " + opponentValue;
													else
														statString += "\n" + sportStats[stat_id].stat_abrv + ": " + userValue + " - " + opponentValue;
												}
											}
										}
									} else if (teamData[team].name == teamName && team == 1) {
										if (userObject.context.sport == "football") {
											matchupString = "Week " + matchupData[matchup].week + " Matchup\n" + teamName + " vs. " + teamData[parseInt(team) - 1].name + "\n\n";
											matchupString += "PTS: " + teamData[team].team_points.total + " <-> " + teamData[parseInt(team) - 1].team_points.total + "\n";
										} else {
											matchupString = "Week " + matchupData[matchup].week + " Matchup\n" + teamName + " vs. " + teamData[parseInt(team) - 1].name + "\n\n";
											matchupString += "PTS: " + teamData[team].team_points.total + " <-> " + teamData[parseInt(team) - 1].team_points.total + "\n";

											const userStatData = teamData[team].team_stats.stats.stat;
											const opponentStatData = teamData[parseInt(team) - 1].team_stats.stats.stat;

											for (const stat in userStatData) {
												const stat_id = userStatData[stat].stat_id;

												if (sportStats.hasOwnProperty(stat_id)) {
													const userValue = userStatData[stat].value;
													const opponentValue = opponentStatData[stat].value;

													if (statString == "")
														statString = sportStats[stat_id].stat_abrv + ": " + userValue + " - " + opponentValue;
													else
														statString += "\n" + sportStats[stat_id].stat_abrv + ": " + userValue + " - " + opponentValue;
												}
											}
										}
									}
								}
							}

							finalString = matchupString + statString;
							return resolve(finalString);
						});
					});
				});
			}
		});
	});
}

const isEmpty = (object) => {
  for (var property in object) {
    if (object.hasOwnProperty(property))
      return false;
  }

  return true;
}

const getSportStats = (sport) => {
	return new Promise((resolve, reject) => {
		console.log("Retrieving stats from the database...");
		let query = {};
		query[sport] = { $exists: true };

		SportStats.findOne(query, (error, result) => {
			console.log("Stats query has been executed...");
			if (error)
				return reject(error);

			const stats = result[sport];
			let statObject = {};

			for (const stat in stats) {
				if (!isNaN(parseInt(stat))) {
					statObject[stat] = {
						stat_name: stats[stat].stat_name,
						stat_abrv: stats[stat].stat_abrv
					};
				}
			}

			return resolve(statObject);
		});
	});
}

exports.getPlayerStats = (userObject) => {
	return new Promise((resolve, reject) => {
		authentication.checkRefresh(userObject.fbid).then((result) => {
			if (result == true) {
				User.findOne({ fb_id: userObject.fbid }, (error, result) => {
					if (error)
						return reject(error);

					const gameData = result.games[0].game;
					let teamKey = "";
					let leagueKey = "";
					if (userObject.context.hasOwnProperty("singleLeague")) {
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											teamKey = teamData[teamObject].team_key;
											leagueKey = teamData[teamObject].league_key;
										}
									}
								}
							}
						}
					} else if (userObject.context.hasOwnProperty("multipleLeagues")) {
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											if (teamData[teamObject].name == userObject.context.team) {
												teamKey = teamData[teamObject].team_key;
												leagueKey = teamData[teamObject].league_key;
											}
										}
									}
								}
							}
						}
					}

					const metaUrl = "http://fantasysports.yahooapis.com/fantasy/v2/league/" + leagueKey + "/scoreboard";
					const oauth = {
						consumer_key: consumerKey,
						consumer_secret: consumerSecret,
						token: result.oauth_token,
						token_secret: result.oauth_token_secret,
						verifier: result.oauth_verifier
					};

					request.get({ url: metaUrl, oauth: oauth}, (error, response, body) => {
						const matchupResponseData = JSON.parse(parser.toJson(body));
						const url = "http://fantasysports.yahooapis.com/fantasy/v2/team/" + teamKey + "/roster/players";

						request.get({ url: url, oauth: oauth}, (error, response, body) => {
							const responseData = JSON.parse(parser.toJson(body));
							const playerData = responseData.fantasy_content.team.roster.players.player;
							let playerKey = "";

							for (const player in playerData) {
								if (playerData[player].name.full.toLowerCase() == userObject.context.player.toLowerCase()) {
									playerKey = playerData[player].player_key;
									break;
								}
							}

							if (playerKey != "") {
								const playerUrl = "http://fantasysports.yahooapis.com/fantasy/v2/player/" + playerKey + "/stats";

								request.get({ url: playerUrl, oauth: oauth }, (error, response, body) => {
									const statsResponseData = JSON.parse(parser.toJson(body));
									const statsData = statsResponseData.fantasy_content.player.player_stats.stats.stat;

									let positionType = null;
									if (userObject.context.sport == "football")
										positionType = statsResponseData.fantasy_content.player.display_position;
									else
										positionType = statsResponseData.fantasy_content.player.position_type;
									const statIds = getStatIds(positionType, userObject.context.sport);

									let playerString = statsResponseData.fantasy_content.player.name.full + " " + statsResponseData.fantasy_content.player.player_stats.season + " Stats\n";
									let statsString = "";
									let finalString = "";

									getSportStats(userObject.context.sport).then((sportStats) => {
										for (const stat in statsData) {
											const stat_id = statsData[stat].stat_id;
											if (sportStats.hasOwnProperty(stat_id)) {
												if (statIds.hasOwnProperty(stat_id)) {
													statsString += "\n" + sportStats[stat_id].stat_abrv + ": " + statsData[stat].value;
												}
											}
										}

										finalString = playerString + statsString;
										return resolve(finalString);
									});
								});
							}
						});
					});
				});
			}
		})
	});
}

const getStatIds = (position, sport) => {
	let idObject = {};
	if (sport == "baseball") {
		if (position == "B") {
			idObject = {
				1: true, 3: true, 4: true, 5: true,
				7: true, 8: true, 12: true, 13: true,
				16: true, 55: true, 61: true
			};
		} else if (position == "P") {
			idObject = {
				17: true, 26: true, 27: true, 28: true,
				29: true, 30: true, 31: true, 56: true,
				57: true, 83: true
			};
		}
	} else if (sport == "basketball") {
		if (position == "P") {
			idObject = {
				2: true, 5: true, 8: true, 9: true,
				11: true, 12: true, 15: true, 16: true,
				17: true, 18: true, 26: true, 27: true,
				28: true
			};
		}
	} else if (sport == "football") {
		if (position == "QB") {
			idObject = {
				0: true, 1: true, 2: true, 3: true,
				4: true, 5: true, 6: true, 7: true,
				17: true, 58: true, 59: true, 60: true,
				79: true
			};
		} else if (position == "WR" || position == "TE") {
			idObject = {
				0: true, 11: true, 12: true, 13: true,
				14: true, 15: true, 17: true, 63: true,
				64: true, 78: true, 80: true
			};
		} else if (position == "RB") {
			idObject = {
				0: true, 8: true, 9: true, 10: true,
				11: true, 12: true, 13: true, 17: true,
				61: true, 62: true, 63: true, 64: true,
				81: true
			}
		} else if (position == "K") {
			idObject = {
				0: true, 19: true, 20: true, 21: true,
				22: true, 23: true, 24: true, 25: true,
				26: true, 27: true, 28: true, 29: true,
				30: true
			};
		} else if (position == "DEF") {
			idObject = {
				0: true, 31: true, 32: true, 33: true,
				34: true, 35: true, 36: true, 50: true,
				51: true, 52: true, 53: true, 54: true,
				55: true, 56: true
			};
		}
	} else if (sport == "hockey") {
		if (position == "P") {
			idObject = {
				0: true, 1: true, 2: true, 3: true,
				4: true, 5: true, 6: true, 7: true,
				9: true, 10: true, 31: true, 32: true
			};
		} else if (position == "G") {
			idObject = {
				0: true, 19: true, 20: true, 23: true,
				26: true, 27: true
			};
		}
	}

	return idObject;
}

exports.getStandings = (userObject) => {
	return new Promise((resolve, reject) => {
		authentication.checkRefresh(userObject.fbid).then((result) => {
			if (result == true) {
				User.findOne({ fb_id: userObject.fbid }, (error, result) => {
					if (error)
						return reject(error);

					const gameData = result.games[0].game;
					let leagueKey = "";
					let teamName = "";
					if (userObject.context.hasOwnProperty("singleLeague")) {
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											teamKey = teamData[teamObject].team_key;
											leagueKey = teamData[teamObject].league_key;
										}
									}
								}
							}
						}
					} else if (userObject.context.hasOwnProperty("multipleLeagues")) {
						for (const gameObject in gameData) {
							if (!isNaN(parseInt(gameObject))) {
								if (gameData[gameObject].name.toLowerCase() == userObject.context.sport.toLowerCase()) {
									const teamData = gameData[gameObject].teams;
									for (const teamObject in teamData) {
										if (!isNaN(parseInt(teamObject))) {
											if (teamData[teamObject].name == userObject.context.team) {
												teamKey = teamData[teamObject].team_key;
												leagueKey = teamData[teamObject].league_key
											}
										}
									}
								}
							}
						}
					}

					const url = "http://fantasysports.yahooapis.com/fantasy/v2/league/" + leagueKey + "/standings";
					const oauth = {
						consumer_key: consumerKey,
						consumer_secret: consumerSecret,
						token: result.oauth_token,
						token_secret: result.oauth_token_secret,
						verifier: result.oauth_verifier
					};

					request.get({ url: url, oauth: oauth }, (error, response, body) => {
						if (error)
							return reject(error);

						const responseData = JSON.parse(parser.toJson(body));
						const standingsData = responseData.fantasy_content.league.standings.teams.team;

						let standingsString = responseData.fantasy_content.league.name + " Standings\n";
						let standingsArray = [];

						for (const team in standingsData) {
							if (team != 0 && team % 4 == 0) {
								standingsArray.push(standingsString);
								standingsString = responseData.fantasy_content.league.name + " Standings\n";
							}

							let rank = standingsData[team].team_standings.rank;

							if (typeof rank == "object")
								rank = 1;


							standingsString += "\n" + rank + ": " + standingsData[team].name + " (" + standingsData[team].team_standings.outcome_totals.wins
							+ "-" + standingsData[team].team_standings.outcome_totals.losses + "-" + standingsData[team].team_standings.outcome_totals.ties + ")";

							if (team == (standingsData.length - 1))
								standingsArray.push(standingsString);
						}

						return resolve(standingsArray);
					});
				});
			}
		});
	});
}

// exports.loadStats = (userObject) => {
// 	return new Promise((resolve, reject) => {
// 		authentication.checkRefresh(userObject.fbid).then((result) => {
// 			if (result == true) {
// 				User.findOne({ fb_id: userObject.fbid }, (error, result) => {
// 					if (error)
// 						return reject(error);
//
// 					const url = "http://fantasysports.yahooapis.com/fantasy/v2/game/nba/stat_categories";
// 					const oauth = {
// 						consumer_key: consumerKey,
// 						consumer_secret: consumerSecret,
// 						token: result.oauth_token,
// 						token_secret: result.oauth_token_secret,
// 						verifier: result.oauth_verifier
// 					};
//
// 					request.get({ url: url, oauth: oauth }, (error, response, body) => {
// 						const responseData = JSON.parse(parser.toJson(body));
// 						const statData = responseData.fantasy_content.game.stat_categories.stats.stat;
// 						let statArray = [];
//
// 						for (const stat in statData) {
// 							const statObject = {
// 								stat_id: statData[stat].stat_id,
// 								stat_name: statData[stat].name,
// 								stat_abrv: statData[stat].display_name
// 							};
// 							statArray.push(statObject);
// 						}
//
// 						let query = {};
// 						let sport = "baseball";
// 						query[sport] = { $exists: true };
//
// 						const conditions = query;
// 						const update = {
// 							basketball: statArray
// 						};
// 						const options = { multi: false };
//
// 						SportStats.findOneAndUpdate(conditions, update, options, (error, result) => {
// 							if (error)
// 								return reject(error);
// 							console.log("Updated stats!");
// 						});
// 					});
// 				});
// 			}
// 		});
// 	});
// }
