//Set up Env Vars
var env_var = {
	environment: process.env.NODE_ENV || 'development';, // supports: production and development
	log_level: process.env.LOGLEVEL,  // supports: debug, error, warn, info, off
	write_mongo: process.env.MONGO_ENABLED, // true / false
	analytics_track: process.env.ANALYTICS_ENABLED, // true / false
			mongo_user: process.env.MONGO_USER_PROD,
			mongo_password: process.env.MONGO_PASSWORD_PROD,
			mongo_server: process.env.MONGO_SERVER_PROD,
			mongo_port: process.env.MONGO_PORT_PROD,
			mongo_db: process.env.MONGO_DB_PROD,
			ga_key: process.env.GOOGLE_ANALYTICS_PROD,
			localytics_key: process.env.LOCALYTICS_PROD,
			mixpanel_token: process.env.MIXPANEL_PROD
};

		
//Set up Reqs
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var qs = require('querystring');
var math = require('mathjs');
var moment = require('moment');
var uuid = require('node-uuid');
var mongodb = require('mongodb');

//Server Details
var app = express();
var port = process.env.PORT || 3000;

//Logger
var logger = exports;
logger.debugLevel = env_var.log_level || 'warn';
logger.log = function(level, message) {
	var levels = ['debug', 'error', 'warn', 'info', 'off'];
	if (levels.indexOf(level) >= levels.indexOf(logger.debugLevel) ) {
		if (typeof message !== 'string') {
			message = JSON.stringify(message);
		};
		console.log(level+': '+message);
		}
}


//Set Body Parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

//Simple Base64 handler
var base64 = exports;
base64.encode = function (unencoded) {
	return new Buffer(unencoded || '').toString('base64');
};

base64.decode = function (encoded) {
	return new Buffer(encoded || '', 'base64').toString('utf8');
};


//Routes
app.get('/', function(req, res){
	res.send('here');
});

app.get('/ping', function(req, res){
	res.send('I\'m alive!');
});

app.post('/collect', function(req, res){

	var channel = {
		id: 	req.body.channel_id,
		name: 	req.body.channel_name
	};

	var user = {
		id: 	req.body.user_id,
		name:	req.body.user_name
	};

	var teamDomain = req.body.team_domain;

	var msgTime = math.round(req.body.timestamp, 0); //in epoch
	
	var msgText = req.body.text;

	function searchM(regex){
		var searchStr = msgText.match(regex);
		if(searchStr != null){
			return searchStr.length;
		}
		return 0;
	}

	function searchS(regex){
		var searchStr = msgText.split(regex);
		if(searchStr != undefined){
			return searchStr.length;
		}
		return 0;
	}

	var wordCount = searchS(/\s+\b/);
	var emojiCount = searchM(/:[a-z_0-9]*:/g);
	var exclaCount = searchM(/!/g);
	var questionMark = searchM(/\?/g);
	var elipseCount = searchM(/\.\.\./g);


	if (env_var.write_mongo === true) {
	var url = "mongodb://"+env_var.mongo_user+":"+env_var.mongo_password+"@"+env_var.mongo_server+":"+env_var.mongo_port+"/"+env_var.mongo_db;
	var collection_name = "posts";
	
	mongodb.MongoClient.connect(url, function (err, db) {
		if (err) {
			logger.log('error', 'Mongo Error: Unable to connect to the server. Error: ' + err);
		} else {
			logger.log('debug','Mongo: Connection established to '+url);
    		var collection = db.collection(collection_name);

			// Insert post contents
			collection.insert(req.body, function (err, result) {
				if (err) {
					logger.log('error', 'Mongo Error: '+err);
				} else {
					logger.log('debug', 'Mongo: '+result.length+' inserted documents into the '+collection_name+' collection. The documents inserted with "_id" are: '+result);
				}
			//Close connection
			db.close(function (err) {
				if (err) {
					logger.log('error','Mongo Error: '+err);
					}
			});
			});
  		}
		}
	);
	}

	if (env_var.analytics_track === true) {
	// GOOGLE ANALYTICS COLLECT AND POST
	if (env_var.ga_key) {
		var GAdata = {
			v: 		1,
			tid: 	env_var.ga_key,
			cid: 	user.id,
			uid: 	user.name,
			ds:  	"slack",
			cd1: 	user.name + " (" + user.id + ")",
			cd2: 	channel.name + " (" + channel.id + ")",
			cd3: 	msgText,
			cm1: 	wordCount,
			cm2: 	emojiCount,
			cm3: 	exclaCount,
			//cm4: 	letterCount,
			cm5: 	elipseCount, 
			cm6: 	questionMark,
			dh:		teamDomain+".slack.com",
			dp:		"/"+channel.name,
			dt:		"Slack Channel: "+channel.name,
			t: 		"event",
			ec: 	"slack: "+ channel.name + " | " + channel.id,
			ea: 	"message posted",
			el: 	msgText,
			ev: 	1 
		};

		var google_url = {
//			if (logging["level"].toLowerCase() === "debug") {
				track: "https://www.google-analytics.com/collect?"
//			} else {
//				track: "https://www.google-analytics.com/collect?"
//			}
		}

		logger.log('debug', "Google Analytics Data: "+JSON.stringify(GAdata));
		logger.log('debug', "Google Analytics Tracking Post Output: "google_url.track + qs.stringify(GAdata));

		// Post Data
		request.post(google_url.track + qs.stringify(GAdata), function(error, resp, body) {
				if(error) {
					logger.log('error', 'Google Analytics Error: '+error);
				}
				logger.log('debug', 'Google Analytics Tracking Response Debug: '+resp);
		});
	} else {
		logger.log('info',"Google Analytics account ID not defined as environment variable");
	}


	// LOCALYTICS COLLECT AND POST
	if (env_var.localytics_key) {
		var lcl_sd_values = {
			device_id:	uuid.v4(),
			session_id:	uuid.v4(),
		};

		// Localytics Session Start
		var LCLstartHeadData = {
				dt: "h",
				pa: msgTime - 1,
				seq: 1,
				u: uuid.v4(),
				attrs: {
					dt: "a",
					au: env_var.localytics_key,
					iu: lcl_sd_values.device_id,
					lv: "slackalytics_0.0.1",
					dmo: "Slack",
					dll: "EN-US",
					dma: "Slack"
				},
				ids: {
					customer_name: user.name,
					customer_id: user.id
				}
		};

		var LCLstartBodyData = {
			dt: "s",
			ct: msgTime,
			u: lcl_sd_values.session_id,
			nth: 1,
			mc: null,
			mm: null,
			ms: null,
			cid: user.id,
			utp: "known"
		};

		// Localytics Event
		var LCLeventHeadData = {
				dt: "h",
				pa: msgTime - 1,
				seq: 2,
				u: uuid.v4(),
				attrs: {
					dt: "a",
					au: env_var.localytics_key,
					iu: lcl_sd_values.device_id,
					lv: "slackalytics_0.0.1",
					dmo: "Slack",
					dll: "EN-US",
					dma: "Slack"
				},
				ids: {
					customer_name: user.name,
					customer_id: user.id
				}
		};
			
		var LCLeventBodyData = {
			ct: msgTime,
			u: uuid.v4(),
			su: lcl_sd_values.session_id,
			mc: null,
			mm: null,
			ms: null,
			dt: "e",
			n: "message posted",
			cid: user.id,
			utp: "known",
			attrs: {
				user: user.name + " (" + user.id + ")",
				channel: channel.name + " (" + channel.id + ")",
				words: wordCount,
				emojis: emojiCount,
				exclamations: exclaCount,
				ellipsis: elipseCount,
				question_marks: questionMark,
				domain: teamDomain+".slack.com"
			}
		};

		// Localytics Session Close
		var LCLcloseHeadData = {
				dt: "h",
				pa: msgTime - 1,
				seq: 3,
				u: uuid.v4(),
				attrs: {
					dt: "a",
					au: env_var.localytics_key,
					iu: lcl_sd_values.device_id,
					lv: "slackalytics_0.0.1",
					dmo: "Slack",
					dll: "EN-US",
					dma: "Slack"
				},
				ids: {
					customer_name: user.name,
					customer_id: user.id
				}
		};
			
		var LCLcloseBodyData = {
				dt: "c",
				u: uuid.v4(),
				ss: msgTime,
				su: lcl_sd_values.session_id,
				ct: msgTime,
				ctl: 0,
				cta: 0,
				fl:[],
				cid: user.id,
				utp: "known"
		};

		var localytics_url = {
//			if (logging["level"].toLowerCase() === "debug") {
//				track: "https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data="
//			} else {
				track: "https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data="
//			}
		}

		logger.log('info', "Localytics Session Start Data: \n Head: "+JSON.stringify(LCLstartHeadData)+"\n Body: "+JSON.stringify(LCLstartBodyData));
		logger.log('info', "Localytics Event Data: \n Head: "+JSON.stringify(LCLeventHeadData)+"\n Body: "+JSON.stringify(LCLeventBodyData));
		logger.log('info', "Localytics Session Close Data: \n Head: "+JSON.stringify(LCLcloseHeadData)+"\n Body: "+JSON.stringify(LCLcloseBodyData));
		logger.log('debug', "Localytics Session Start Tracking Post Output: "localytics_url.track + encodeURIComponent(JSON.stringify(LCLstartHeadData)+"%0A"+JSON.stringify(LCLstartBodyData)));
		logger.log('debug', "Localytics Event Tracking Post Output: "localytics_url.track + encodeURIComponent(JSON.stringify(LCLeventHeadData)+"%0A"+JSON.stringify(LCLeventBodyData)));
		logger.log('debug', "Localytics Session Close Start Tracking Post Output: "localytics_url.track + encodeURIComponent(JSON.stringify(LCLcloseHeadData)+"%0A"+JSON.stringify(LCLcloseBodyData)));

		// Post Data
		// Session Start
		request.post(localytics_url.track + encodeURIComponent(JSON.stringify(LCLstartHeadData)+"%0A"+JSON.stringify(LCLstartBodyData)), function(error, resp, body) {
				logger.log('debug','Localytics Tracking Start Response Debug: '+resp);
				if(error) {
					logger.log('error', 'Localytics Error: '+error);
				}
		});
		// Event
		request.post(localytics_url.track + encodeURIComponent(JSON.stringify(LCLeventHeadData)+"%0A"+JSON.stringify(LCLeventBodyData)), function(error, resp, body) {
				logger.log('debug','Localytics Tracking Event Response Debug: '+resp);
				if(error) {
					logger.log('error', 'Localytics Error: '+error);
				}
		});
		// Session Close
		request.post(localytics_url.track + encodeURIComponent(JSON.stringify(LCLcloseHeadData)+"%0A"+JSON.stringify(LCLcloseBodyData)), function(error, resp, body) {
				logger.log('debug','Localytics Tracking Close Response Debug: '+resp);
				if(error) {
					logger.log('error', 'Localytics Error: '+error);
				}
		});
	} else {
		logger.log('info', "Localytics application key not defined as environment variable");
	}


	// MIXPANEL COLLECT AND POST
	if (env_var.mixpanel_token) {
		var mixTrack = {
			event:	"message posted",
			properties:	{
					$os: "Slack",
					$browser: "Slack",
					$current_url: "https://"+teamDomain+".slack.com/" + channel.name,
					mp_lib: "slack_nodeJS",
					$lib_version: "Slack 0.0.1",
					distinct_id: user.id,
					num_words: wordCount,
					num_emoji: emojiCount,
					num_exclamation: exclaCount,
					num_ellipsis: elipseCount,
					num_questions: questionMark,
					message: msgText,
					channel: channel.name + " (" + channel.id + ")",
					user: user.name + " (" + user.id + ")",
					time: msgTime,
					token: env_var.mixpanel_token
				}
		};

		var engage_channel_info = {};
		engage_channel_info[channel.name] = 1;
		engage_channel_info["total_posts"] = 1;

		var mixAddEngage = {
			$distinct_id: user.id,
			$time: msgTime,
			$token: env_var.mixpanel_token,
			$add: engage_channel_info
		};

		var mixSetEngage = {
			$distinct_id: user.id,
			$time: msgTime,
			$token: env_var.mixpanel_token,
			$set: {
					last_post: moment.unix(msgTime).format('YYYY-MM-DDThh:mm:ss')
			}		
		};


		var mixpanel_url = {
//			if (logging["level"].toLowerCase() === "debug") {
//				track: "https://api.mixpanel.com/track/?verbose=1&ip=0&data=",
//				engage: "https://api.mixpanel.com/engage/?verbose=1&ip=0&data="
//			} else {
				track: "https://api.mixpanel.com/track/?ip=0&data=",
				engage: "https://api.mixpanel.com/engage/?ip=0&data="			
//			}
		}

		logger.log('info', "Mixpanel Tracking Data: "+JSON.stringify(mixTrack));
		logger.log('info', "Mixpanel Add Engage Data: "+JSON.stringify(mixAddEngage));
		logger.log('info', "Mixpanel Set Engage Data: "+JSON.stringify(mixSetEngage));
		logger.log('debug', "Mixpanel Tracking Post Output: "mixpanel_url.track + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))));
		logger.log('debug', "Mixpanel Add Engage Post Output: "mixpanel_url.engage + encodeURIComponent(base64.encode(JSON.stringify(mixAddEngage))));
		logger.log('debug', "Mixpanel Set Engage Post Output: "mixpanel_url.engage + encodeURIComponent(base64.encode(JSON.stringify(mixSetEngage))));

		// Post Data
		request.post(mixpanel_url.track + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))), function(error, resp, body) {
				logger.log('debug', 'Mixpanel Tracking Response Debug: '+resp);
				if(error) {
					logger.log('error','Mixpanel Error: '+error);
				}
		});
		request.post(mixpanel_url.engage + encodeURIComponent(base64.encode(JSON.stringify(mixAddEngage))), function(error, resp, body) {
				logger.log('debug', 'Mixpanel Engage Response Debug: '+resp);
				if(error) {
					logger.log('error', 'Mixpanel Error: '+error);
				}
		});
		request.post(mixpanel_url.engage + encodeURIComponent(base64.encode(JSON.stringify(mixSetEngage))), function(error, resp, body) {
				logger.log('debug', 'Mixpanel Engage Response Debug: '+resp);
				if(error) {
					logger.log('error', 'Mixpanel Error: '+error);
				}
		});
	} else {
		logger.log('info', "Mixpanel token not defined as environment variable");
	}
	}

// DEBUG LOGGING
	logger.log('info', "Raw Slack Webhook Post: "+JSON.stringify(req.body));
});

//Start Server
app.listen(port, function () {
	logger.log('info', 'Listening on port ' + port); 
});
