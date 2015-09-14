//Set up Env Vars
var env_var = {
	debug: process.env.DEBUG,  // supports: info and debug
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

		// Post Data
		request.post("https://www.google-analytics.com/collect?" + qs.stringify(GAdata), function(error, resp, body){console.log(error);});
	} else {
		console.log("Google Analytics account ID not defined as environment variable");
	}


// LOCALYTICS COLLECT AND POST
	if (env_var.localytics_key) {
		var lcl_sd_values = {
			device_id:	uuid.v4(),
			session_id:	uuid.v4(),
		};
	
		var LCLstartData = {
			e: 1,
			client_date: msgTime,
			callback: "z",
			data: {
				dt: "h",
				pa: msgTime - 1,
				seq:1,
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
			}%0A{
				dt: "s",
				ct: msgTime,
				u: lcl_sd_values.session_id,
				nth: 1,
				mc: null,
				mm: null,
				ms: null,
				cid: user.id,
				utp: "known"
				}
		};

		var LCLeventData = {
			e: 1,
			client_date: msgTime,
			callback: z,
			data: {
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
			}%0A{
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
			}
		};


		var LCLcloseData = {
			e: 1,
			client_date: msgTime,
			callback: "z",
			data: {
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
			}%0A{
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
			}
		};

		// Post Data
		// session start
		request.post("https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?" + qs.stringify(LCLstartData), function(error, resp, body){console.log(error);});
		// event
		request.post("https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?" + qs.stringify(LCLeventData), function(error, resp, body){console.log(error);});
		// session close
		request.post("https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?" + qs.stringify(LCLcloseData), function(error, resp, body){console.log(error);});
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

		var mixEngage = {
			$distinct_id: user.id,
			$time: msgTime,
			$token: env_var.mixpanel_token,
			$add: engage_channel_info,
			$set: {
					last_post: moment.unix(msgTime).format('YYYY-MM-DDThh:mm:ss')
			}		
		};

		// Post Data
		request.post("https://api.mixpanel.com/track/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))) + "&ip=0", function(error, resp, body){console.log(error);});
		request.post("https://api.mixpanel.com/engage/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixEngage))) + "&ip=0", function(error, resp, body){console.log(error);});
	} else {
		console.log("Mixpanel token not defined as environment variable");
	}

// DEBUG LOGGING
	if (env_var.debug.toLowerCase() === "info") {
		console.log("Raw Slack Webhook Post: "+JSON.stringify(req.body));
		if (env_var.ga_key) {
			console.log("Google Analytics Data: "+JSON.stringify(GAdata));
		}
		if (env_var.localytics_key) {
			console.log("Localytics Session Start Data: "+JSON.stringify(LCLstartData));
			console.log("Localytics Event Data: "+JSON.stringify(LCLeventData));
			console.log("Localytics Session Close Data: "+JSON.stringify(LCLcloseData));
		}
		if (env_var.mixpanel_token) {
			console.log("Mixpanel Tracking Data: "+JSON.stringify(mixTrack));
			console.log("Mixpanel Engage Data: "+JSON.stringify(mixEngage));
		}
	}
	
	if (env_var.debug.toLowerCase() === "debug") {
		console.log("Raw Slack Webhook Post: "+JSON.stringify(req.body));
		if (env_var.ga_key) {
			console.log("Google Analytics Data: "+JSON.stringify(GAdata));
			console.log("Google Analytics Tracking Post Output: https://www.google-analytics.com/collect?" + qs.stringify(GAdata));
		}
		if (env_var.localytics_key) {
			console.log("Localytics Session Start Data: "+JSON.stringify(LCLstartData));
			console.log("Localytics Event Data: "+JSON.stringify(LCLeventData));
			console.log("Localytics Session Close Data: "+JSON.stringify(LCLcloseData));
			console.log("Localytics Session Start Tracking Post Output: https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?" + qs.stringify(LCLstartData));
			console.log("Localytics Event Tracking Post Output: https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?" + qs.stringify(LCLeventData));
			console.log("Localytics Session Close Start Tracking Post Output: https://webanalytics.localytics.com/api/v2/applications/" + env_var.localytics_key + "/uploads/image.gif?" + qs.stringify(LCLcloseData));
		}
		if (env_var.mixpanel_token) {
			console.log("Mixpanel Tracking Data: "+JSON.stringify(mixTrack));
			console.log("Mixpanel Engage Data: "+JSON.stringify(mixEngage));
			console.log("Mixpanel Tracking Post Output: https://api.mixpanel.com/track/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))) + "&ip=0");
			console.log("Mixpanel Engage Post Output: https://api.mixpanel.com/engage/?data=" + encodeURIComponent(base64.encode(JSON.stringify(mixEngage))) + "&ip=0");
		}
	}
});

//Start Server
app.listen(port, function () {
	console.log('Listening on port ' + port); 
});
