'use strict';

// Dependencies and Parameters
const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const qs = require('querystring');

const Wit = require('node-wit').Wit;
const log = require('node-wit').log;

const yahoo = require('./utils/yahoo');
const Mongo = require('./utils/models/mongo');
const User = require('./utils/models/user');
const authentication = require('./utils/authentication');

const PORT = process.env.PORT || 8445;

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const redirectUri = process.env.REDIRECT_URI;

const WIT_TOKEN = process.env.WIT_TOKEN;

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

// Messenger API Specific Code
const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

const sendErrorMessage = (id) => {
  const text = "Uh oh! It seems like something went wrong when I was processing your request. Please try again :)"
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

const sendStandingsMessage = (userObject, standingsArray) => {
  return new Promise((resolve, reject) => {
    const text = "Anything else I can do for you?";
    const message = "Here are the standings for your " + userObject.context.sport + " league: ";
    fbMessage(userObject.fbid, message).then(() => {
      for (const standingsString in standingsArray) {
        fbMessage(userObject.fbid, standingsArray[standingsString]).then(() => {
          if (standingsString == (standingsArray.length - 1)) {
            fbMessage(userObject.fbid, text).then(() => null);
            return resolve();
          }
        });
      }
    }).catch((err) => {
      console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
      sendErrorMessage(userObject.fbid);
    });
  });
};

const sendMatchupMessage = (userObject, matchup) => {
  return new Promise((resolve, reject) => {
    const text = "Anything else I can do for you?";
    const message = "Here is your " + userObject.context.sport + " matchup for this week: ";
    fbMessage(userObject.fbid, message).then(() => {
      fbMessage(userObject.fbid, matchup).then(() => {
        fbMessage(userObject.fbid, text).then(() => null);
        return resolve();
      });
    }).catch((err) => {
      console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
      sendErrorMessage(userObject.fbid);
    });
  });
};

const sendPlayerMessage = (userObject, stats) => {
  return new Promise((resolve, reject) => {
    const text = "Anything else I can do for you?";
    const message = "Here are " + userObject.context.player + "'s stats: ";
    fbMessage(userObject.fbid, message).then(() => {
      fbMessage(userObject.fbid, stats).then(() => {
        fbMessage(userObject.fbid, text).then(() => null);
        return resolve();
      });
    }).catch((err) => {
      console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
      sendErrorMessage(userObject.fbid);
    });
  });
};

const sendLineupMessage = (userObject, lineup) => {
  return new Promise((resolve, reject) => {
    const text = "Anything else I can do for you?";
    const message = "Here is your " + userObject.context.sport + " lineup! 🏆";

    fbMessage(userObject.fbid, message).then(() => {
      if (userObject.context.sport == "baseball") {
        fbMessage(userObject.fbid, lineup.offense).then(() => {
          fbMessage(userObject.fbid, lineup.pitchers).then(() => {
            if (lineup.bench != "") {
              fbMessage(userObject.fbid, lineup.bench).then(() => {
                fbMessage(userObject.fbid, text);
                return resolve();
              });
            } else {
              fbMessage(userObject.fbid, text);
              return resolve();
            }
          });
        }).catch((err) => {
          console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
          sendErrorMessage(userObject.fbid);
        });
      } else if (userObject.context.sport == "basketball") {
        fbMessage(userObject.fbid, lineup.offense).then(() => {
          if (lineup.bench != "") {
            fbMessage(userObject.fbid, lineup.bench).then(() => {
              fbMessage(userObject.fbid, text);
              return resolve();
            });
          }
        });
      } else if (userObject.context.sport == "football") {
        fbMessage(userObject.fbid, lineup.offense).then(() => {
          if (lineup.bench != "") {
            fbMessage(userObject.fbid, lineup.bench).then(() => {
              fbMessage(userObject.fbid, text);
              return resolve();
            });
          } else {
            fbMessage(userObject.fbid, text);
            return resolve();
          }
        }).catch((err) => {
          console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
          sendErrorMessage(userObject.fbid);
        });
      } else if (userObject.context.sport == "hockey") {
        fbMessage(userObject.fbid, lineup.offense).then(() => {
          fbMessage(userObject.fbid, lineup.defense).then(() => {
            if (lineup.bench != "") {
              fbMessage(userObject.fbid, lineup.bench).then(() => {
                fbMessage(userObject.fbid, text);
                return resolve();
              });
            } else {
              fbMessage(userObject.fbid, text);
              return resolve();
            }
          });
        }).catch((err) => {
          console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
          sendErrorMessage(userObject.fbid);
        });
      }
    }).catch((err) => {
      console.log("Oops! An error occurred while forwarding the response to " + userObject.fbid + ": " + err.stack || err);
      sendErrorMessage(userObject.fbid);
    });
  });
};

// TO-DO: Handle case of 3+ buttons (i.e. "More..." button)
const sendTeamsMessage = (id, object) => {
  let buttonArray = [];
  let payloadContext = "";

  if (object.context.hasOwnProperty("lineup"))
    payloadContext = "lineup";
  else if (object.context.hasOwnProperty("matchup"))
    payloadContext = "matchup";
  else if (object.context.hasOwnProperty("standings"))
    payloadContext = "standings";
  else if (object.context.hasOwnProperty("player"))
    payloadContext = "player";

  const teams = object.result.teams;
  for (const team in teams) {
    const button = {
      type: "postback",
      title: teams[team],
      payload: payloadContext + ":" + object.context.sport + ":" + teams[team]
    };
    buttonArray.push(button);
  }

  const body = JSON.stringify({
    recipient: { id },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "For which team?",
          buttons: buttonArray
        }
      }
    }
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// Wit.ai Bot Specific Code
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      sessionId = k;
    }
  });
  if (!sessionId) {
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

const allEntityValues = (entities, entity) => {
  const val = entities && entities[entity] &&
  Array.isArray(entities[entity]) &&
  entities[entity].length > 0;

  if (!val)
    return null;

  let entityArray = [];
  let array = entities[entity];

  for (const object in array) {
    entityArray.push(array[object].value);
  }

  return entityArray;
};

// Wit.ai Bot Actions (The important stuff!)
const actions = {
  send({sessionId}, {text}) {
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {

      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error("Oops! An error occurred while forwarding the response to" + recipientId + ":" + err.stack || err);
        sendErrorMessage(userObject.fbid);
      });
    } else {
      console.error("Oops! Couldn't find user for session: " + sessionId);
      sendErrorMessage(userObject.fbid);
      return Promise.resolve();
    }
  },
  getAuthentication({ sessionId, context, entities }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        authentication.checkAuthentication(recipientId).then((result) => {
          if (result == true) {
            context.returningUser = true;
          } else {
            context.newUser = true;
          }

          if (isEmpty(entities)) {
            console.log("Entities not present");
          } else {
            console.log("Entities present");
            if (entities.hasOwnProperty("intent") && entities.hasOwnProperty("player")) {
              const player = allEntityValues(entities, "player");
              const intent = allEntityValues(entities, "intent");
              let playerObject = {};

              if (player.length == 2 && intent.length == 2) {
                if (intent.indexOf("lineup") != -1 && intent.indexOf("bench") != -1) {
                  playerObject = {
                    firstPlayer: player[0] + ":" + intent[0],
                    secondPlayer: player[1] + ":" + intent[1]
                  };
                  context.player = playerObject;
                  context.lineup = true;
                  context.bench = true;
                } else {
                  // TO-DO: Error handling for other intents
                }
              } else if (player.length == 2 && intent.length == 1) {
                // unlikely case
                if (intent.indexOf("lineup") != -1) {
                  playerObject = {
                    firstPlayer: player[0] + ":" + intent[0],
                    secondPlayer: player[1],
                    missing: "bench"
                  };
                  context.player = playerObject;
                  context.lineup = true;
                } else if (intent.indexOf("bench") != -1) {
                  playerObject = {
                    firstPlayer: player[0] + ":" + intent[0],
                    secondPlayer: player[1],
                    missing: "lineup"
                  };
                  context.player = playerObject;
                  context.bench = true;
                }
              } else if (player.length == 1 && intent.length == 2) {
                if (intent.indexOf("lineup") != -1 && intent.indexOf("bench") != -1) {
                  playerObject = {
                    firstPlayer: player[0] + ":" + intent[0],
                    secondPlayer: ":" + intent[1],
                    missing: "player"
                  };
                  context.player = playerObject;
                  context.lineup = true;
                  context.bench = true;
                } else {
                  sendErrorMessage(userObject.fbid);
                }
              } else if (player.length == 1 && intent.length == 1) {
                if (intent.indexOf("lineup") != -1) {
                  playerObject = {
                    firstPlayer: player[0] + ":" + intent[0],
                    missing: "playerbench"
                  };
                  context.player = playerObject;
                  context.lineup = true;
                } else if (intent.indexOf("bench") != -1) {
                  playerObject = {
                    firstPlayer: player[0] + ":" + intent[0],
                    missing: "playerlineup"
                  };
                  context.player = playerObject;
                  context.bench = true;
                }
              } else {
                sendErrorMessage(userObject.fbid);
                sessions[sessionId].context.done = true;
                const context = sessions[sessionId].context;
                actions.clearSession({ sessionId, context });
              }

              if (entities.hasOwnProperty("sport")) {
                context.sport = firstEntityValue(entities, "sport");
              }
            } else if (entities.hasOwnProperty("intent")) {
              console.log("Intent present");
              if (firstEntityValue(entities, "intent") == "lineup") {
                console.log("Seeking lineup");
                context.lineup = true;
                if (entities.hasOwnProperty("sport")) {
                  console.log("Sport identified");
                  context.sport = firstEntityValue(entities, "sport");
                } else {
                  console.log("Sport not found");
                }
              } else if (firstEntityValue(entities, "intent") == "standings") {
                console.log("Seeking standings");
                context.standings = true;
                if (entities.hasOwnProperty("sport")) {
                  console.log("Sport identified");
                  context.sport = firstEntityValue(entities, "sport");
                } else {
                  console.log("Sport not found");
                }
              } else if (firstEntityValue(entities, "intent") == "playing") {
                console.log("Seeking matchup");
                context.matchup = true;
                if (entities.hasOwnProperty("sport")) {
                  console.log("Sport identified");
                  context.sport = firstEntityValue(entities, "sport");
                } else {
                  console.log("Sport not found");
                }
              } else {
                // TO-DO: Add more functionality based on user intent
              }
            } else if (entities.hasOwnProperty("player")) {
              console.log("Player present");
              context.player = firstEntityValue(entities, "player");
              if (entities.hasOwnProperty("datetime")) {
                console.log("Date identified");
                context.datetime = firstEntityValue(entities, "datetime");
              } if (entities.hasOwnProperty("sport")) {
                console.log("Sport identified");
                context.sport = firstEntityValue(entities, "sport");
              }
            } else {
              console.log("Intent not present");
            }
          }
          console.log(context);
          console.log("-----------");
          return resolve(context);
        });
      } else {
        console.error("Oops! Couldn't find user for session: " + sessionId);
        return Promise.resolve();
      }
    });
  },
  getAuthenticationUrl({ sessionId, context, entities }) {
    // Getting the OAuth authentication URL and passing it to Wit via context
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        authentication.getAuthenticationUrl(recipientId).then((result) => {
          context.newAuthentication = result;
          return resolve(context);
        });
      } else {
        console.error("Oops! Couldn't find user for session: " + sessionId);
      }
    });
  },
  updateDoneContext({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      if (!context.hasOwnProperty("done"))
        context.done = true;
      return resolve(context);
    });
  },
  clearSession({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      if (context.hasOwnProperty("done")) {
        delete sessions[sessionId];
        console.log("Session deleted");
      } else {
        // TO-DO: More error checking
        console.log("Session not deleted");
      }
      return Promise.resolve();
    });
  },
  deleteUser({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        authentication.deleteUser(recipientId).then(() => {
          console.log("User successfully deleted");
          sessions[sessionId].context.done = true;
          const context = sessions[sessionId].context;
          actions.clearSession({ sessionId, context });
        })
      } else {
        console.error("Oops! Couldn't find user for session: " + sessionId);
      }
    });
  },
  updateSportContext({ sessionId, context, entities }) {
    return new Promise((resolve, reject) => {
      console.log("Updating sport context...");
      if (entities.hasOwnProperty("sport")) {
        console.log("Sport entity found");
        context.sport = firstEntityValue(entities, "sport");
      } else {
        console.log("Sport entity not found");
        context.notSport = true;
      }

      console.log(context);
      return resolve(context);
    });
  },
  checkNumberOfLeagues({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        yahoo.getTeamCount(recipientId, context.sport).then((count) => {
          if (count > 1) {
            context.multipleLeagues = true;
          } else if (count == 1) {
            context.singleLeague = true;
          } else {
            context.noLeagues = true;
            context.done = true;
          }

          console.log(context);
          console.log("----------");
          return resolve(context);
        });
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  },
  sendLeagueMessage({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        yahoo.getTeams(recipientId, context.sport).then((result) => {
          const messageObject = { result, context };
          sendTeamsMessage(recipientId, messageObject);
          context.didNotClick = true;
          return resolve(context);
        });
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  },
  getLineup({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        const userObject = { fbid: recipientId, context };
        yahoo.getLineup(userObject).then((result) => {
          sendLineupMessage(userObject, result).then(() => {
            context.done = true;
            return resolve(context);
          });
        });
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  },
  getStandings({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        const userObject = { fbid: recipientId, context };

        yahoo.getStandings(userObject).then((result) => {
          sendStandingsMessage(userObject, result).then(() => {
            context.done = true;
            return resolve(context);
          });
        });
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  },
  getMatchup({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        const userObject = { fbid: recipientId, context };
        console.log("Checking matchup...");

        yahoo.getMatchup(userObject).then((result) => {
          if (result) {
            sendMatchupMessage(userObject, result);
            context.done = true;
            return resolve(context);
          } else {
            // TO-DO: Error checking for matchups
          }
        });
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  },
  getPlayerStats({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        const userObject = { fbid: recipientId, context };
        console.log("Checking player stats...");

        yahoo.getPlayerStats(userObject).then((result) => {
          if (result) {
            sendPlayerMessage(userObject, result);
            context.done = true;
            return resolve(context);
          } else {
            // TO-DO: Error checking for stats
          }
        });
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  },
  movePlayers({ sessionId, context }) {
    return new Promise((resolve, reject) => {
      const recipientId = sessions[sessionId].fbid;

      if (recipientId) {
        console.log(context);
        console.log("-----------------");
      } else {
        console.error("Oops! Couldn't find user for session:", sessionId);
        return Promise.resolve();
      }
    });
  }
};

// Wit Instance Creation
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Webserver Creation and Handling
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

app.get('/', (req, res) => {
  res.send("Welcome to my website!");
});

// Webhook Setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// OAuth Webhook
app.get('/callback', (req, res) => {
  const oauthToken = res.req.res.socket.parser.incoming.query.oauth_token;
  const oauthVerifier = res.req.res.socket.parser.incoming.query.oauth_verifier;

  if (oauthToken != null && oauthVerifier != null) {
    authentication.updateVerifier(oauthToken, oauthVerifier).then((body) => {
      if (body == true) {
        res.redirect("https://www.m.me/fantasybot");
        console.log("Preparing to update verifier...");
        authentication.getVerifier(oauthVerifier).then((fbid) => {
          console.log("Preparing to get user details...");
          authentication.getUserDetails(fbid).then((data) => {
            const sessionId = findOrCreateSession(fbid);
            const firstMessage = "You're all set up!";
            const secondMessage = "Since you're new, here are some questions you can ask me.\n• Who is in my baseball lineup?\n• Who am I playing this week in basketball?\n• What are the standings in my hockey league?";

            fbMessage(fbid, firstMessage).then(() => {
              fbMessage(fbid, secondMessage).then(() => {
                sessions[sessionId].context.done = true;
                const context = sessions[sessionId].context;
                actions.clearSession({ sessionId, context });
              });
            });
          });
        });
      }
    });
  }
});

// Message Handler
app.post('/webhook', (req, res) => {
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          const sender = event.sender.id;
          const sessionId = findOrCreateSession(sender);
          const {text, attachments} = event.message;

          if (attachments) {
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // Here is the meat and potatoes of the bot
            wit.runActions(sessionId, text, sessions[sessionId].context).then((context) => {
              console.log('Waiting for next user messages');
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else if (event.postback) {
          const sender = event.sender.id;
          const sessionId = findOrCreateSession(sender);
          const payload = event.postback.payload;
          const splitPayload = payload.split(":");

          if (event.postback.payload == "resetSession") {
            sessions[sessionId].context.done = true;
            const context = sessions[sessionId].context;
            actions.clearSession({ sessionId, context });
          } else if (event.postback.payload == "yahooLogout") {
            authentication.deleteUser(sender).then(() => {
              console.log("User successfully deleted");
              sessions[sessionId].context.done = true;
              const context = sessions[sessionId].context;
              actions.clearSession({ sessionId, context });
            });
          } else {
            sessions[sessionId].context.multipleLeagues = true;
            sessions[sessionId].context.sport = splitPayload[1];
            sessions[sessionId].context.team = splitPayload[2];

            const userObject = {
              fbid: sender,
              context: sessions[sessionId].context
            };

            if (splitPayload[0] == "lineup") {
              yahoo.getLineup(userObject).then((result) => {
                sendLineupMessage(userObject, result).then(() => {
                  sessions[sessionId].context.done = true;
                  const context = sessions[sessionId].context;
                  actions.clearSession({ sessionId, context });
                });
              });
            } else if (splitPayload[0] == "matchup") {
              yahoo.getMatchup(userObject).then((result) => {
                sendMatchupMessage(userObject, result).then(() => {
                  sessions[sessionId].context.done = true;
                  const context = sessions[sessionId].context;
                  actions.clearSession({ sessionId, context });
                });
              });
            } else if (splitPayload[0] == "standings") {
              yahoo.getStandings(userObject).then((result) => {
                sendStandingsMessage(userObject, result).then(() => {
                  sessions[sessionId].context.done = true;
                  const context = sessions[sessionId].context;
                  actions.clearSession({ sessionId, context });
                });
              });
            } else if (splitPayload[0] == "player") {
              yahoo.getPlayerStats(userObject).then((result) => {
                sendPlayerMessage(userObject, result).then(() => {
                  sessions[sessionId].context.done = true;
                  const context = sessions[sessionId].context;
                  actions.clearSession({ sessionId, context });
                });
              });
            }
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});

function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

const isEmpty = (object) => {
  for (var property in object) {
    if (object.hasOwnProperty(property))
      return false;
  }

  return true;
}

app.listen(PORT);
console.log("Server is listening on port " + PORT);
