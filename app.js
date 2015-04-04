
//Set up Reqs
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var qs = require('querystring');

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
		v:1,
		tid:"UA-61435895-1",
		cid:555 ,
		t:"event",
		ec:"slack channel "+ req.body.channel_name,
		ea:"post by " + req.body.user_name,
		el:req.body.text,        //the text of the message
		ev:300 	}

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