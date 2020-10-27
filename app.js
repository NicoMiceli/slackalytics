//Set up Env Vars
var env_var = {
	environment: process.env.NODE_ENV || 'development', // supports: production and development
	log_level: process.env.LOGLEVEL,  // supports: debug, error, warn, info, off
	write_mongo: process.env.MONGO_ENABLED, // true / false
	analytics_track: process.env.ANALYTICS_ENABLED, // true / false
	mongo_user: process.env.MONGO_USER_PROD,
	mongo_password: process.env.MONGO_PASSWORD_PROD,
	mongo_server: process.env.MONGO_SERVER_PROD,
	mongo_port: process.env.MONGO_PORT_PROD,
	mongo_db: process.env.MONGO_DB_PROD,
	mongo_cluster_db: process.env.MONGO_CLUSTER_DB,
	mongo_shard_1: process.env.MONGO_SHARD_ONE,
	mongo_shard_1_port: process.env.MONGO_SHARD_ONE_PORT,
	mongo_shard_2: process.env.MONGO_SHARD_TWO,
	mongo_shard_2_port: process.env.MONGO_SHARD_TWO_PORT,
	mongo_shard_3: process.env.MONGO_SHARD_THREE,
	mongo_shard_3_port: process.env.MONGO_SHARD_THREE_PORT,
	mongo_shard_query: process.env.MONGO_QUERY,
	ga_key: process.env.GOOGLE_ANALYTICS_PROD,
	mixpanel_key: process.env.MIXPANEL_PROD,
	segmentio_key: process.env.SEGMENTIO_PROD,
	logentries_key: process.env.LOGENTRIES_PROD
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
var Analytics = require('analytics-node');
var logentries = require('le_node');

//Server Details
var app = express();
var port = process.env.PORT || 3000;

//SegmentIO
var analytics = new Analytics(env_var.segmentio_key);

//Logentries Service
var le = new logentries({
	token: env_var.logentries_key
});

//Logger
var logger = exports;
logger.debugLevel = env_var.log_level || 'warn';
logger.log = function(level, message) {
	var levels = ['debug', 'error', 'warn', 'info', 'off'];
	if (levels.indexOf(level) >= levels.indexOf(logger.debugLevel) ) {
		if (typeof message !== 'string') {
			message = JSON.stringify(message);
		}
		console.log(level+': '+message);
        if (level === 'error') { le.log('err', message); }
        else if (level === 'warn') { le.log('warning', message); }
		else { le.log(level, message); }
		}
};

//Set Body Parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

//Simple Base64 handler
var base64 = exports;
base64.encode = function (unencoded) {
	return new Buffer.from(unencoded || '').toString('base64');
};
base64.decode = function (encoded) {
	return new Buffer.from(encoded || '', 'base64').toString('utf8');
};

//Routes
app.get('/', function(req, res){
	res.send('here');
});

app.get('/ping', function(req, res){
	res.send('I\'m alive!' + "   Ping Time: " + new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''));
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

	var msgTime = math.round(req.body.timestamp, 0); //in epoch by day
	
	var msgSeconds = req.body.timestamp.replace(/./g,''); //in epoch by millisecond
	
	var msgText = req.body.text;

	function searchM(regex){
		var searchStr = msgText.match(regex);
		if(searchStr !== null){
			return searchStr.length;
		}
		return 0;
	}

	function searchS(regex){
		var searchStr = msgText.split(regex);
		if(searchStr !== undefined){
			return searchStr.length;
		}
		return 0;
	}

	var wordCount = searchS(/\s+\b/);
	var emojiCount = searchM(/:[a-z_0-9_-]*:/g);
	var exclaCount = searchM(/!/g);
	var questionMark = searchM(/\?/g);
	var elipsisCount = searchM(/\.\.\./g);
	var alertCount = searchM(/<!/g);
	var urlCount = searchM(/<http/g);


	if (env_var.write_mongo) {
//	var url = "mongodb://"+env_var.mongo_user+":"+env_var.mongo_password+"@"+env_var.mongo_shard_1+":"+env_var.mongo_shard_1_port+","+env_var.mongo_shard_2+":"+env_var.mongo_shard_2_port+","+env_var.mongo_shard_3+":"+env_var.mongo_shard_3_port+"/"+env_var.mongo_cluster_db+"?"+env_var.mongo_shard_query;
//	var url = "mongodb://"+env_var.mongo_user+":"+env_var.mongo_password+"@"+env_var.mongo_server+":"+env_var.mongo_port+"/"+env_var.mongo_db;
    var url = "mongodb+srv://"+env_var.mongo_user+":"+encodeURIComponent(env_var.mongo_password)+"@measurechat.rz4ev.mongodb.net/"+env_var.mongo_cluster_db+"?retryWrites=true&w=majority";
	var collection_name = "posts";
      
    var client = new mongodb.MongoClient(url, { useNewUrlParser: true });
	
	client.connect(function(err) {
		if (err) {logger.log('error', 'Mongo Error: Unable to connect to the server. Error: ' + JSON.stringify(err));}
		else {logger.log('debug','Mongo: Connection established to '+url);
    		var collection = client.db(env_var.mongo_cluster_db).collection(collection_name);

			// Insert post contents
			collection.insert(req.body, function (err, result) {
				if (err) {logger.log('error', 'Mongo Error: '+JSON.stringify(err));}
				else {logger.log('debug', 'Mongo: '+result.length+' inserted documents into the '+collection_name+' collection. The documents inserted with "_id" are: '+JSON.stringify(result));	}
			//Close connection
			db.close(function (err) {
				if (err) {logger.log('error','Mongo Error: '+JSON.stringify(err));}
			});
			});
  		}
		}
	);
	}

	if (env_var.analytics_track) {
	// GOOGLE ANALYTICS COLLECT AND POST
	if (env_var.ga_key) {
		var GAdata = {
			v: 		1,
			tid: 	env_var.ga_key,
			cid: 	user.id,
			uid: 	user.name,
			ds:  	"slack",
			ua:		"Slack 1.2.0",
			cd1: 	user.name + " (" + user.id + ")",
			cd2: 	channel.name + " (" + channel.id + ")",
			cd3: 	msgText,
			/*cm1: 	wordCount,
			cm2: 	emojiCount,
			cm3: 	exclaCount,
			cm4: 	letterCount,
			cm5: 	elipsisCount, 
			cm6: 	questionMark,*/
			dh:		teamDomain+".slack.com",
			dp:		"/"+channel.name,
			dt:		"Slack Channel: "+channel.name,
			t: 		"event",
			ec: 	"slack: "+ channel.name + " | " + channel.id,
			ea: 	"message posted",
			el: 	"posted by: "+ user.name + " (" + user.id + ")",
			an:		"Slackalytics",
			av:		"1.2.0",
			ni:		1,
			ev: 	1 
		};

		var google_url = {track: "https://www.google-analytics.com/collect?"};

		logger.log('debug', "Google Analytics Data: "+JSON.stringify(GAdata));
		logger.log('debug', "Google Analytics Tracking Post Output: "+google_url.track + qs.stringify(GAdata));

		// Post Data
		request.post(google_url.track + qs.stringify(GAdata), function(error, resp, body) {
				if(error) {logger.log('error', 'Google Analytics Error: '+JSON.stringify(error));} 
				else {logger.log('debug', 'Google Analytics Tracking Response Debug: '+JSON.stringify(resp));}
		});
	} else {logger.log('error',"Google Analytics account ID not defined as environment variable");}

	// MIXPANEL COLLECT AND POST
	if (env_var.mixpanel_key) {
		var mixTrack = {
			event:	"message posted",
			properties:	{
					$os: "Slack",
					$browser: "Slack",
					$current_url: "https://"+teamDomain+".slack.com/" + channel.name,
					mp_lib: "slack_nodeJS",
					$lib_version: "Slack 1.2.0",
					distinct_id: user.id,
					/*num_words: wordCount,
					num_emoji: emojiCount,
					num_exclamation: exclaCount,
					num_ellipsis: elipsisCount,
					num_questions: questionMark,*/
					message: msgText,
					channel: channel.name + " (" + channel.id + ")",
					user: user.name + " (" + user.id + ")",
					time: msgTime,
					seconds: msgSeconds,
					token: env_var.mixpanel_key
				}
		};

		var mixpanel_url = {track: "https://api.mixpanel.com/track/?ip=0&data="};

		logger.log('debug', "Mixpanel Tracking Data: "+JSON.stringify(mixTrack));
		logger.log('debug', "Mixpanel Tracking Post Output: "+mixpanel_url.track + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))));

		// Post Data
		request.post(mixpanel_url.track + encodeURIComponent(base64.encode(JSON.stringify(mixTrack))), function(error, resp, body) {
				if(error) {logger.log('error','Mixpanel Error: '+JSON.stringify(error));}
				else {logger.log('debug', 'Mixpanel Tracking Response Debug: '+JSON.stringify(resp));}
		});
	} else {logger.log('error', "Mixpanel account ID not defined as environment variable");}

	// SEGMENTIO COLLECT AND POST
	if (env_var.segmentio_key) {
		analytics.identify({
		  userId: user.id,
		  traits: {
			username: user.name
		  }
		});

		analytics.track({
		  userId: user.id,
		  event: 'message posted',
		  properties: {
			message: msgText,
			channel: channel.name + " (" + channel.id + ")",
			user: user.name + " (" + user.id + ")",
			time: msgTime,
			seconds: msgSeconds,
			os: "Slack",
			browser: "Slack",
			current_url: "https://"+teamDomain+".slack.com/" + channel.name,
			lib_version: "Slack 1.2.0"
		  }
		});

		analytics.screen({
		  userId: user.id,
		  name: channel.name + " (" + channel.id + ")"
		});
		} else {	logger.log("error", "SegmentIO token not defined as environment variable");}
	}

// DEBUG LOGGING
	logger.log('info', "Raw Slack Webhook Post: "+JSON.stringify(req.body));

	res.send("OK")
});

//Start Server
app.listen(port, function () {logger.log('info', 'Listening on port ' + port);});
