const path = require('path');
const express = require('express');
var router = express.Router();
const app = express();
var jwt = require('jsonwebtoken');
const moment = require('moment');
var ACCESS_TOKEN_SECRET = "0cf22951fd77561b6eef4587d187050604b8256ece9c9e5b13e3161529094cdcbc0c0c3056da254d975799bb93e3eeb818dd0623345683e8fad04e163ef54rtd";
const resizeImg = require('resize-img');
var db = require('../db');

// var urlBase= 'http://localhost:4000/'
// var urlBase='https://jpj-dev.i2utors.com:4000/';


router.get('/getBusinessRule', function (req, res) {
  db.query("SELECT * FROM business_rule", function (err, rows) {
    if (err) {
      console.log("rows=====list of users=errrr====", err);
      var err = new Error("Something went wrong");
    }
    //console.log("rows=====list of users=====",rows);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(rows);
  });
});

router.post('/setUserDetails', function (req, res) {
  var userData = req.body.userData;
  console.log("process.env.ACCESS_TOKEN_SECRET", ACCESS_TOKEN_SECRET)
  userData.authToken = jwt.sign({ usertoken: userData.email }, ACCESS_TOKEN_SECRET);
  console.log("userData====", userData)

  db.query("SELECT * FROM user_details WHERE email_id='" + userData.email + "'", function (err, rows) {
    if (err) {
      console.log("Problem with MySQL productcatalog", err);
    }
    if (rows) {
      if (rows.length > 0) {
        console.log("Already Exists!!!!!!!!!!!!!!!!!!!!!!!!");
        res.status(200).send({ 'status': 'Already Exists' });
      } else {
        var q = "";
        if (userData['selfieImage'] !== '') {
          console.log("if----111111111-");
          q = "INSERT INTO user_details(user_name,authToken,email_id,password,selfie_image,role) VALUES ('" + userData.fullName + "','" + userData.authToken + "','" + userData.email + "','" + userData.password + "','" + userData.selfieImage + "',0)";
        } else {
          console.log("else----11111111-");
          q = "INSERT INTO user_details(user_name,authToken,email_id,password,role) VALUES ('" + userData.fullName + "','" + userData.authToken + "','" + userData.email + "','" + userData.password + "',0)"
        }
        db.query(q, function (err, user) {
          if (err) {
            console.log("Problem with MySQL productcatalog", err);
          } else {
            console.log("Datatttt", user);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
          }
        });
      }
    }
  })
});



router.post('/getLoginUser', function (req, res) {
  var userData = req.body.userData;
  console.log("userData===", userData);
  var q = "";
  if (userData['selfieImage'] !== '') {
    console.log("if----111111111-");
    q = "SELECT * FROM user_details WHERE selfie_image='" + userData.selfieImage + "'";
  } else {
    console.log("else----11111111-", "SELECT * FROM user_details WHERE email_id='" + userData.email + "' and password='" + userData.password + "'");
    q = "SELECT * FROM user_details WHERE email_id='" + userData.email + "' and password='" + userData.password + "'"
  }
  db.query(q, function (err, rows) {
    if (err) {
      //  console.log("Problem with MySQL productcatalog",err);
    }
    if (rows) {
      console.log("rows===", rows.length)
      if (rows.length > 0) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({ 'status': 'Success', 'role': rows[0].role, 'authToken': rows[0].authToken, 'username': rows[0].user_name });
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({ 'status': 'Failure' });
      }
    }


  });
});


router.get('/getUserList', function (req, res) {
  db.query("SELECT * FROM user_details WHERE selfie_image IS NOT NULL", function (err, rows) {
    if (err) {
      console.log("rows=====list of users=errrr====", err);
      var err = new Error("Something went wrong");
    }
    //console.log("rows=====list of users=====",rows);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(rows);
  });
});





router.post('/getCurrentUser', function (req, res) {
  var authtoken = req.body.authToken;
  db.query("SELECT * FROM user_details WHERE authToken='" + authtoken + "'", function (err, userInfo) {
    if (err) {
      console.log("Problem with MySQL productcatalog", err);
    } else {
      db.query("SELECT * FROM student_cart_details WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authtoken + "') and cart_status='Open'", function (err, cartInfo) {
        if (err) {
          console.log("Problem with MySQL productcatalog", err);
        } else {
          db.query("SELECT * FROM course_wishlist WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authtoken + "') and status=1", function (err, wishList) {
            if (err) {
              console.log("Problem with MySQL productcatalog", err);
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.status(200).send({ 'userInfo': userInfo, 'cartInfo': cartInfo, 'wishCount': wishList });
            }
          });
        }
      })
    }
  })
});


router.post('/updateProfileInfo', function (req, res) {
  var loginInfo = req.body.loginInfo;
  console.log("loginInfo===",loginInfo);
  db.query("UPDATE user_details set user_name='" + loginInfo.first_name + "',last_name='" + loginInfo.last_name + "',head_line='" + loginInfo.headline + "',biography='" + loginInfo.biography + "',website='" + loginInfo.website + "',twitter='" + loginInfo.twitter + "',linkedin='" + loginInfo.linkedIn + "',facebook='" + loginInfo.facebook + "',youtube='" + loginInfo.youtube + "' WHERE id='" + loginInfo.id + "'", function (err, updateinfo) {
    if (err) {
      console.log("Problem with MySQL productcatalog", err);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(updateinfo);
    }
  });
});


router.post('/updateProfileImage', function (req, res) {
  var profileinfo = req.body.profileinfo;
  db.query("UPDATE user_details set selfie_image='" + profileinfo.profile_img + "' WHERE id='" + profileinfo.id + "'", function (err, updateinfo) {
    if (err) {
      console.log("Problem with MySQL productcatalog", err);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(updateinfo);
    }
  });
});



router.post('/UpdateEmailAddress', function (req, res) {
  var profileinfo = req.body.profileinfo;
  db.query("SELECT * FROM user_details WHERE id='" + profileinfo.id + "' and password='" + profileinfo.existing_password + "'", function (err, userinfo) {
    if (err) {
      console.log("Problem with MySQL productcatalog", err);
    } if (userinfo) {
      if (userinfo.length > 0) {
        if (profileinfo.existing_email === profileinfo.email_id) {
          res.setHeader('Content-Type', 'application/json');
          res.status(200).send({ 'status': 'Nochange' });
        } else {
          db.query("SELECT * FROM user_details WHERE email_id='" + profileinfo.email_id + "' and id NOT IN('" + profileinfo.id + "')", function (err, existsCheck) {
            if (err) {
              console.log("Problem with MySQL productcatalog", err);
            }
            if (existsCheck) {
              if (existsCheck.length > 0) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({ 'status': 'Email exists' });
              } else {
                db.query("UPDATE user_details SET email_id='" + profileinfo.email_id + "' WHERE id ='" + profileinfo.id + "'", function (err, rows) {
                  if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                  } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({ 'status': 'Success' });
                  }
                })
              }
            }
          })
        }
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({ 'status': 'Password Mismatch' });
      }

    }
  });
});

router.post('/UpdatePassword', function (req, res) {
  var profileinfo = req.body.profileinfo;
  db.query("UPDATE user_details SET password='" + profileinfo.new_password + "' WHERE id ='" + profileinfo.id + "'", function (err, rows) {
    if (err) {
      console.log("Problem with MySQL productcatalog", err);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send({ 'status': 'Success' });
    }
  })
});

module.exports = router;