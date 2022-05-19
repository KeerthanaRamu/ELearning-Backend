const path = require('path');
const express = require('express');
var router = express.Router(); 
const app = express();
var db = require('../db');


router.post('/getVideoToPlay',function(req,res){
  var userAuth=req.body.userAuth;
  console.log("userAuth====",userAuth);
      db.query("SELECT face_image FROM users WHERE authToken='"+userAuth+"'", function(err, userData) {
        if (err) {
            console.log("err===",err);
        }
        if(userData){
          console.log("userData======",userData)
          db.query("SELECT * FROM video_list WHERE active=1 and id NOT IN (SELECT video_id FROM user_video WHERE user_id=(SELECT id FROM users WHERE authToken='"+userAuth+"')) ORDER BY id ASC LIMIT 1", function(err, videoData) {
            if (err) {
                console.log("err===",err);
            }
            if(videoData){
                db.query("SELECT * FROM video_list WHERE active=1 and id NOT IN (SELECT video_id FROM user_video WHERE user_id=(SELECT id FROM users WHERE authToken='"+userAuth+"')) ORDER BY id ASC", function(err, playlist) {
                  if (err) {
                      console.log("err===",err);
                  }
                  if(playlist){
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({'userData':userData[0],'videoData':videoData,'playlist':playlist});
                  }
              })
            }
        })
      }
    })
});


router.post('/getVideoQueries',function(req,res){
    var videoId=req.body.videoId;
      db.query("SELECT * FROM video_queries WHERE video_id='"+videoId+"'", function(err, rows) {
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows===",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});



router.post('/setVideoResult',function(req,res){
  var videoData=req.body.videoData;
  var anscount=req.body.anscount;
  var result=req.body.result;
  var userAuth=req.body.userAuth;
      console.log("INSERT INTO user_video (user_id,video_id,ans_count) VALUES ((SELECT id FROM users WHERE authToken='"+userAuth+"'),'"+videoData[0].video_id+"','"+anscount+"')")
      db.query("INSERT INTO user_video (user_id,video_id,ans_count) VALUES ((SELECT id FROM users WHERE authToken='"+userAuth+"'),'"+videoData[0].video_id+"','"+anscount+"')", function(err, rows) {
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows===",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});


router.post('/getVideoPlayList',function(req,res){
  var userAuth=req.body.userAuth;
      db.query("SELECT * FROM video_list WHERE active=1 and id IN (SELECT video_id FROM user_video WHERE user_id=(SELECT id FROM users WHERE authToken='"+userAuth+"')) ORDER BY id ASC", function(err, rows) {
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows==getVideoPlayList==============",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});


router.get('/getCoursesList',function(req,res){
      db.query("SELECT * FROM course_list WHERE active=1 ORDER BY id ASC", function(err, rows) {
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows==getVideoPlayList==============",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});


router.post('/checkCourseAppliedForUser',function(req,res){
  var userAuth=req.body.userAuth;
      db.query("SELECT b.* FROM users a JOIN user_course b ON a.authToken='"+userAuth+"' and a.id=b.user_id", function(err, rows) {
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows==getVideoPlayList==============",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});


router.post('/setCourseDetails',function(req,res){
  var coursedata=req.body.coursedata;
  var userAuth=req.body.userAuth;
       db.query("INSERT INTO user_course (user_id,course_id) VALUES ((SELECT id FROM users WHERE authToken='"+userAuth+"'),'"+coursedata.id+"')", function(err, rows) {
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows==getVideoPlayList==============",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});


router.post('/setPaymentDetails',function(req,res){
  var coursedata=req.body.coursedata;
  var userAuth=req.body.userAuth;
      console.log("UPDATE user_course set payment_status='Done' WHERE user_id=(SELECT id FROM users WHERE authToken='"+userAuth+"') and course_id='"+coursedata.id+"'");
      db.query("UPDATE user_course set payment_status='Done' WHERE user_id=(SELECT id FROM users WHERE authToken='"+userAuth+"')", function(err, rows) {  // and course_id='"+coursedata.id+"'
        if (err) {
            console.log("err===",err);
        }
        if(rows){
            console.log("rows==getVideoPlayList==============",rows);
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send(rows);
        }
    })
});

module.exports = router;