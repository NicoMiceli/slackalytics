
//Set up Reqs
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var qs = require('querystring');
var channel = {
	id: 	req.body.channel_id,
	name: 	req.body.channel_name
	}
var user = {
	id: 	req.body.user_id,
	name: 	req.body.user_name
}
var msgText = req.body.text

//Server Details
var app = express();
var port = process.env.PORT || 3000;

//Set Body Parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json()); 
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); 


//Routes
app.get('/', function(req, res){
	res.send('here');
});

app.post('/collect', function(req, res){	

	//Structure Data
	var data = {
		v: 		1,
		tid: 	"UA-61435895-1",
		cid: 	req.body.user_id,
		ds:  	"slack", //data source
		cd1: 	req.body.user_id,
		cd2: 	req.body.channel_name,
		t: 		"event",
		ec: 	"slack: "+ req.body.channel_name + " " + req.body.channel_id,
		ea: 	"post by " + req.body.user_name + "|"+req.body.user_id,
		el: 	msgText,
		ev: 	300 	
	}
	console.log(req.body.channel_name+"|"+user.name+"|"+msgText)
	//Make Post Request	
	request.post("https://www.google-analytics.com/collect?"  + qs.stringify(data), 
		function(error, resp, body){
		console.log(error);
	})
});


//Start Server
app.listen(port, function () {
  console.log('Listening on port ' + port); 
});