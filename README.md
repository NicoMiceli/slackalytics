# Slackalytics

Slackalytics is a textual analysis bot built in Node.js that allows for deeper custome analytics by sending message strings to Google Analysis via Slacks realtime API and Google Analytics Measurement Protocol.

More Readme info is coming soon

In the meantime checkout the post for this on my blog: http://nicomiceli.com/slackalytics/ 

Created by [Nico Miceli](http://nicomiceli.com) and [Joe Zeoli](http://joezeoli.com)


Change Log
------------

9/17/15 - updated the GA UA ID to work as an enviroment variable `GOOGLE_ANALYTICS_UAID`in heroku. To set the environment variables add the following in the command line after the app was uploaded: 
```
heroku config:set GOOGLE_ANALYTICS_UAID=UA-XXXXXXX-Y
``` 