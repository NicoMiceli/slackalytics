//Set up Env Vars
var env_var = {
	environment: process.env.NODE_ENV, // supports: production and development
	log_level: process.env.LOGLEVEL,  // supports: info and debug
	write_mongo: process.env.MONGO_ENABLED, // true / false
	analytics_track: process.env.ANALYTICS_ENABLED, // true / false

/*	if (env_var.environment.toLowerCase() === "production") { */
		if (env_var.write_mongo === true) {
			mongo_user: process.env.MONGO_USER_PROD,
			mongo_password: process.env.MONGO_PASSWORD_PROD,
			mongo_server: process.env.MONGO_SERVER_PROD,
			mongo_port: process.env.MONGO_PORT_PROD,
			mongo_db: process.env.MONGO_DB_PROD,
		}
		if (env_var.analytics_track === true) {
			ga_key: process.env.GOOGLE_ANALYTICS_PROD,
			localytics_key: process.env.LOCALYTICS_PROD,
			mixpanel_token: process.env.MIXPANEL_PROD,
		}
/*	} else {	
		if (env_var.write_mongo === true) {
			mongo_user: process.env.MONGO_USER_DEV,
			mongo_password: process.env.MONGO_PASSWORD_DEV,
			mongo_server: process.env.MONGO_SERVER_DEV,
			mongo_port: process.env.MONGO_PORT_DEV,
			mongo_db: process.env.MONGO_DB_DEV,
		}
		if (env_var.analytics_track === true) {
			ga_key: process.env.GOOGLE_ANALYTICS_DEV,
			localytics_key: process.env.LOCALYTICS_DEV,
			mixpanel_token: process.env.MIXPANEL_DEV,
		}
	} */
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
	mongodb.MongoClient.connect(url, function (err, db) {
		if (err) {
			console.log('Mongo Error: Unable to connect to the server. Error:', err);
		} else {
			if (env_var.debug.toLowerCase() === "debug") {
				console.log('Mongo: Connection established to', url);
			}
    		var collection = db.collection('posts');

			// Insert post contents
			collection.insert(req.body, function (err, result) {
				if (err) {
					console.log('Mongo Error: '+err);
				} else {
					if (env_var.debug.toLowerCase() === "info" || env_var.debug.toLowerCase() === "debug") {
						console.log('Mongo: Inserted %d documents into the "posts" collection. The documents inserted with "_id" are:', result.length, result);
					}
				}
			//Close connection
			db.close(function (err) {
				if (err) {
					console.log('Mongo Error: '+err);
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

		if (env_var.debug.toLowerCase() === "info" || env_var.debug.toLowerCase() === "debug") {
			console.log("Google Analytics Data: "+JSON.stringify(GAdata));
		}

		if (env_var.debug.toLowerCase() === "debug") {
			console.log("Google Analytics Tracking Post Output: https://www.google-analytics.com/collect?" + qs.stringify(GAdata));
		}

		// Post Data
		request.post("https://www.google-analytics.com/collect?" + qs.stringify(GAdata), function(error, resp, body){ if(error){ console.log('GA Error: '+error);}});
	} else {
		console.log("Google Analytics account ID not defined as environment variable");
	}


	// LOCALYTICS COLLECT AND POST
	if (env_var.localytics_key) {
		var lcl_sd_values = {
			device_id:	uuid.v4(),
			session_id:	uuid.v4(),
		};
	
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


		if (env_var.debug.toLowerCase() === "info" || env_var.debug.toLowerCase() === "debug") {
			console.log("Localytics Session Start Data: \n Head: "+JSON.stringify(LCLstartHeadData)+"\n Body: "+JSON.stringify(LCLstartBodyData));
			console.log("Localytics Event Data: \n Head: "+JSON.stringify(LCLeventHeadData)+"\n Body: "+JSON.stringify(LCLeventBodyData));
			console.log("Localytics Session Close Data: \n Head: "+JSON.stringify(LCLcloseHeadData)+"\n Body: "+JSON.stringify(LCLcloseBodyData));
		}

		if (env_var.debug.toLowerCase() === "debug") {
			console.log("Localytics Session Start Tracking Post Output: https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data=" + encodeURIComponent(JSON.stringify(LCLstartHeadData)+"%0A"+JSON.stringify(LCLstartBodyData)));
			console.log("Localytics Event Tracking Post Output: https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data=" + encodeURIComponent(JSON.stringify(LCLeventHeadData)+"%0A"+JSON.stringify(LCLeventBodyData)));
			console.log("Localytics Session Close Start Tracking Post Output: https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data=" + encodeURIComponent(JSON.stringify(LCLcloseHeadData)+"%0A"+JSON.stringify(LCLcloseBodyData)));
		}

		// Post Data
		// session start
		request.post("https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data=" + encodeURIComponent(JSON.stringify(LCLstartHeadData)+"%0A"+JSON.stringify(LCLstartBodyData)), function(error, resp, body){ if(error){ console.log('Localytics Error: '+error);}});
		// event
		request.post("https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data=" + encodeURIComponent(JSON.stringify(LCLeventHeadData)+"%0A"+JSON.stringify(LCLeventBodyData)), function(error, resp, body){ if(error){ console.log('Localytics Error: '+error);}});
		// session close
		request.post("https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?e=1&client_date="+msgTime+"&callback=z&data=" + encodeURIComponent(JSON.stringify(LCLcloseHeadData)+"%0A"+JSON.stringify(LCLcloseBodyData)), function(error, resp, body){ if(error){ console.log('Localytics Error: '+error);}});
	} else {
		console.log("Localytics application key not defined as environment variable");
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

		if (env_var.debug.toLowerCase() === "info" || env_var.debug.toLowerCase() === "debug") {
			console.log("Mixpanel Tracking Data: "+JSON.stringify(mixTrack));
			console.log("Mixpanel Add Engage Data: "+JSON.stringify(mixAddEngage));
			console.log("Mixpanel Set Engage Data: "+JSON.stringify(mixSetEngage));
		}

		if (env_var.debug.toLowerCase() === "debug") {
			console.log("Mixpanel Tracking Post Output: https://api.mixpanel.com/track/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))) + "&ip=0");
			console.log("Mixpanel Add Engage Post Output: https://api.mixpanel.com/engage/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixAddEngage))) + "&ip=0");
			console.log("Mixpanel Set Engage Post Output: https://api.mixpanel.com/engage/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixSetEngage))) + "&ip=0");
		}

		// Post Data
		request.post("https://api.mixpanel.com/track/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))) + "&ip=0", function(error, resp, body){ if(error){ console.log('Mixpanel Error: '+error);}});
		request.post("https://api.mixpanel.com/engage/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixAddEngage))) + "&ip=0", function(error, resp, body){ if(error){ console.log('Mixpanel Error: '+error);}});
		request.post("https://api.mixpanel.com/engage/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixSetEngage))) + "&ip=0", function(error, resp, body){ if(error){ console.log('Mixpanel Error: '+error);}});
	} else {
		console.log("Mixpanel token not defined as environment variable");
	}
	}

// DEBUG LOGGING
	if (env_var.debug.toLowerCase() === "info" || env_var.debug.toLowerCase() === "debug") {
		console.log("Raw Slack Webhook Post: "+JSON.stringify(req.body));
	}
});

//Start Server
app.listen(port, function () {
	console.log('Listening on port ' + port); 
});
