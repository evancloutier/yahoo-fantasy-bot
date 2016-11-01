//importing modules
const fs = require('fs');
const mongoose = require('mongoose');
const parser = require('xml2json');
const qs = require('querystring');
const request = require('request');

const yahoo = require('./yahoo');
const Mongo = require('./models/mongo');
const User = require('./models/user');

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const redirectUri = process.env.REDIRECT_URI;

exports.checkAuthentication = (fb_id) => {
  return new Promise((resolve, reject) => {
    User.findOne({ fb_id: fb_id }, (error, result) => {
      if (error)
        return reject(error);

      if (result)
        return resolve(true);
      else
        return resolve(false);
    });
  });
}

exports.checkVerifier = (fb_id) => {
  return new Promise((resolve, reject) => {
    User.findOne({ fb_id: fb_id }, (error, result) => {
      if (error)
        return reject(error);

      if (result) {
        if (result.oauth_verifier)
          return resolve(true);
        else
          return resolve(false);
      }
    });
  });
}

exports.updateVerifier = (token, verifier) => {
  return new Promise((resolve, reject) => {
    User.findOne({ oauth_token: token }, (error, result) => {
      if (error)
        return reject(error);

      if (result) {
        // located the token
        if (result.oauth_verifier == null) {
          // ensure that our verifier hasn't already been written
          const conditions = { oauth_token: token };
          const update = { oauth_verifier: verifier };
          const options = { multi: false };

          User.update(conditions, update, options, (error, result) => {
            if (error)
              return reject(error);
            console.log("Successfully updated verifier");
            return resolve(true);
          });
        }
      } else {
        // couldn't find the token
        return resolve(false);
      }

    })
  });
}

exports.getAuthenticationUrl = (fb_id) => {
  return new Promise((resolve, reject) => {
    const url = "https://api.login.yahoo.com/oauth/v2/get_request_token";
    const oauth = {
      callback: redirectUri,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    };

    request.post({ url: url, oauth: oauth }, (error, response, body) => {
      if (error)
        reject(error);

      const responseData = qs.parse(body);

      let user = new User({
        fb_id: fb_id,
        yahoo_guid: null,
        oauth_token: responseData.oauth_token,
        oauth_token_secret: responseData.oauth_token_secret,
        oauth_verifier: null,
        oauth_session_handle: null,
        creation_time: null
      });

      user.save((error, user) => {
        if (error)
          reject(error);
        console.log("User saved!");
      });

      const authenticationUrl = responseData.xoauth_request_auth_url;
      resolve(authenticationUrl);
    });
  });
}

exports.deleteUser = (fb_id) => {
  return new Promise((resolve, reject) => {
    User.findOneAndRemove({ fb_id: fb_id }, (error, result) => {
      if (error)
        return reject(error);
      return resolve();
    });
  });
}

exports.getVerifier = (verifier) => {
  return new Promise((resolve, reject) => {
    let fbid = "";

    User.findOne({ oauth_verifier: verifier }, (error, result) => {
      if (error)
        return reject(error);

      if (result) {
        fbid = result.fb_id;
        const url = "https://api.login.yahoo.com/oauth/v2/get_token";
        const oauth = {
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
          token: result.oauth_token,
          token_secret: result.oauth_token_secret,
          verifier: result.oauth_verifier
        };

        request.post({ url: url, oauth: oauth }, (error, response, body) => {
          if (error)
            return reject(error);

          const tokenData = qs.parse(body);

          const conditions = { oauth_verifier: verifier };
          const update = {
            yahoo_guid: tokenData.xoauth_yahoo_guid,
            oauth_token: tokenData.oauth_token,
            oauth_token_secret: tokenData.oauth_token_secret,
            oauth_session_handle: tokenData.oauth_session_handle,
            creation_time: (Date.now() / 1000 / 60)
          };
          const options = { mutli: false };

          User.update(conditions, update, options, (error, result) => {
            if (error)
              return reject(error);
            else {
              console.log("Successfully updated OAuth credentials");
              console.log(result);
              console.log("----------------");
              return resolve(fbid);
            }
          });
        });
      }
    });
  });
}

exports.getUserDetails = (fb_id) => {
  return new Promise((resolve, reject) => {
    User.findOne({ fb_id: fb_id }, (error, result) => {
      if (error)
        return reject(error);

      const url = "http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/teams";
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

        const parsedData = JSON.parse(parser.toJson(body));
        const userDetails = parsedData.fantasy_content.users.user;
        let gamesArray = [];
        let gameArray = [];

        for (const userObject in userDetails) {
          if (userObject == "games") {
            const gameDetails = userDetails[userObject].game;
            const gameCount = userDetails[userObject].count;

            if (gameCount == 1) {
              let teamArray = [];
              const teamsDetail = gameDetails.teams;
              const sport = gameDetails.name;
              const season = gameDetails.season;
              const type = gameDetails.type;
              const isActive = yahoo.checkCurrentSeason(sport.toLowerCase(), season);

              if (!isEmpty(teamsDetail) && type == "full" && isActive) {
                const teamCount = teamsDetail.count;
                const teamDetails = teamsDetail.team;

                if (teamCount > 1) {
                  for (const teamObject in teamDetails) {
                    const splitKey = teamDetails[teamObject].team_key.split(".");
                    const leagueKey = splitKey[0] + "." + splitKey[1] + "." + splitKey[2];

                    const team = {
                      name: teamDetails[teamObject].name,
                      team_key: teamDetails[teamObject].team_key,
                      league_key: leagueKey
                    };

                    teamArray.push(team);
                  }
                } else {
                  const splitKey = teamDetails.team_key.split(".");
                  const leagueKey = splitKey[0] + "." + splitKey[1] + "." + splitKey[2];

                  const team = {
                    name: teamDetails.name,
                    team_key: teamDetails.team_key,
                    league_key: leagueKey
                  };

                  teamArray.push(team);
                }

                const game = {
                  name: sport.toLowerCase(),
                  game_key: gameDetails.game_key,
                  season: season,
                  teams: teamArray
                };

                gameArray.push(game);
              }
            } else {
              for (const gameObject in gameDetails) {
                let teamArray = [];
                const teamsDetail = gameDetails[gameObject].teams;
                const sport = gameDetails[gameObject].name;
                const season = gameDetails[gameObject].season;
                const type = gameDetails[gameObject].type;
                const isActive = yahoo.checkCurrentSeason(sport.toLowerCase(), season);

                if (!isEmpty(teamsDetail) && type == "full" && isActive) {
                  const teamCount = teamsDetail.count;
                  const teamDetails = teamsDetail.team;

                  if (teamCount > 1) {
                    for (const teamObject in teamDetails) {
                      const splitKey = teamDetails[teamObject].team_key.split(".");
                      const leagueKey = splitKey[0] + "." + splitKey[1] + "." + splitKey[2];

                      const team = {
                        name: teamDetails[teamObject].name,
                        team_key: teamDetails[teamObject].team_key,
                        league_key: leagueKey
                      };

                      teamArray.push(team);
                    }
                  } else {
                      const splitKey = teamDetails.team_key.split(".");
                      const leagueKey = splitKey[0] + "." + splitKey[1] + "." + splitKey[2];

                      const team = {
                        name: teamDetails.name,
                        team_key: teamDetails.team_key,
                        league_key: leagueKey
                      };

                      teamArray.push(team);
                  }

                  const game = {
                    name: sport.toLowerCase(),
                    game_key: gameDetails[gameObject].game_key,
                    season: gameDetails[gameObject].season,
                    teams: teamArray
                  };

                  gameArray.push(game);
                }
              }
            }
          }
        }

        const games = { game: gameArray };
        gamesArray.push(games);

        console.log(gamesArray);
        console.log("----------------");

        // updating our user in the database
        const conditions = { fb_id: fb_id };
        const update = { games: gamesArray };
        const options = { multi : false };
        User.update(conditions, update, options, (error, result) => {
          if (error)
            return console.log(error);
          console.log("Successfully added user Yahoo! data");
          return resolve(true);
        });
      });
    });
  });
}

exports.checkRefresh = (fb_id) => {
  return new Promise((resolve, reject) => {
    User.findOne({ fb_id: fb_id }, (error, result) => {
      if (error)
        return reject(error);

      if (result) {
        const difference = (Date.now() / 60000) - result.creation_time;

        if (difference > 59) {
          const url = "https://api.login.yahoo.com/oauth/v2/get_token";
          const oauth = {
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            token: result.oauth_token,
            token_secret: result.oauth_token_secret,
            session_handle: result.oauth_session_handle,
            signature_method: 'PLAINTEXT'
          };

          request.post({ url: url, oauth: oauth }, (error, response, body) => {
            const refreshData = qs.parse(body);

            const conditions = { fb_id: fb_id };
            const update = {
              oauth_token: refreshData.oauth_token,
              oauth_token_secret: refreshData.oauth_token_secret,
              oauth_session_handle: refreshData.oauth_session_handle,
              creation_time: (Date.now() / 60000)
            };
            const options = { multi: false };

            User.update(conditions, update, options, (error, result) => {
              if (error)
                return reject(error);
              console.log("Successfully refreshed token");
              resolve(true);
            });
          });
        } else {
          console.log("Tokens still valid");
          resolve(true);
        }
      } else {
        resolve(false);
      }
    });
  });
}

function isEmpty(object) {
  for (var property in object) {
    if (object.hasOwnProperty(property))
      return false;
  }

  return true;
}
