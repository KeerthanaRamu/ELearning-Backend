const express = require('express');
var app = express();
var cors = require('cors')
const http = require("http");
const https = require("https");
const bodyparser = require('body-parser');
var mysql = require('mysql');
var connection = require('express-myconnection');
const path = require('path')
var db = require('./db');
var DOT_SERVER = "https://wiseconsole-demo.wiseai.tech/sdk/token";

// var jwt = require('jsonwebtoken');
// var ACCESS_TOKEN_SECRET = "0cf22951fd77561b6eef4587d187050604b8256ece9c9e5b13e3161529094cdcbc0c0c3056da254d975799bb93e3eeb818dd0623345683e8fad04e163ef54rtd";
// console.log("adminTook=====", jwt.sign({ usertoken: 'admin@gmail.com' }, ACCESS_TOKEN_SECRET))

app.set(db);

app.use(cors());
app.use(bodyparser.json({ limit: '50mb' }));
app.use(bodyparser.urlencoded({ limit: "50mb", extended: true }));


app.use(async function (req, res, next) {
  if (req.url.startsWith("/api")) {
    // these requests we simply forward into the dot-core server
    const result = await postRequest(DOT_SERVER, req.body.token);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(result);
    return;
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
    next();
  }

});

app.use(function (err, req, res, next) {
  res.status(500);
  res.send("Oops, something went wrong.")
});


login = require('./expressRoutes/login');
videoPlayer = require('./expressRoutes/videoPlayer');
instructor = require('./expressRoutes/instructor');

app.use('/login', login);
app.use('/videoPlayer', videoPlayer);
app.use('/instructor', instructor);
app.use(express.static(__dirname + '/'));
app.use(express.static(path.join(__dirname, '../frontend/dist/'))) // BUT ON PRODUCTION -> nginx

app.get('*', (req, res) => {
  return res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
})



// do a http-post-request with a json-body
function postRequest(url, body) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + body
    },
  };
  return new Promise((resolve, reject) => {
    const request = url.startsWith("https://") ? https.request : http.request;
    const req = request(url, options, (res) => {
      resolve(streamToBuf(res));
    });
    req.on("error", (e) => {
      reject(e);
    });
    req.write(JSON.stringify(body));
    req.end();
  });
}
function streamToBuf(stream) {
  const parts = [];
  return new Promise((resolve, reject) => {
    stream.on("error", (e) => {
      reject(e);
    });
    stream.on("data", (part) => {
      parts.push(part);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(parts));
    });
  });
}



const server = app.listen(4000, () =>
  console.log('Express server is runnig  mysql at port no : 4000'));

