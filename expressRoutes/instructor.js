const path = require('path');
const express = require('express');
var router = express.Router();
const app = express();
var jwt = require('jsonwebtoken');
const moment = require('moment');
const fs = require('fs')
var ACCESS_TOKEN_SECRET = "0cf22951fd77561b6eef4587d187050604b8256ece9c9e5b13e3161529094cdcbc0c0c3056da254d975799bb93e3eeb818dd0623345683e8fad04e163ef54rtd";
const resizeImg = require('resize-img');
var db = require('../db');
var async = require('async');
const multer = require('multer');
const { getVideoDurationInSeconds } = require('get-video-duration')


var urlBase = 'http://localhost:4000/'
// var urlBase='https://jpj-dev.i2utors.com:4000/';

router.post('/setCourseDetails', function (req, res) {
    var authToken = req.body.authToken;
    var courseInfo = req.body.courseInfo
    console.log("userData====", courseInfo)
    db.query("INSERT INTO instructor_course (user_id,course_title,category_id,course_status) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseInfo.courseTitle + "','" + courseInfo.category + "','DRAFT')", function (err, setcourse) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            console.log("setcourse===", setcourse);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success', 'courseId': setcourse.insertId });
        }
    })
});

router.get('/getCategoryList', function (req, res) {
    db.query("SELECT * FROM course_category WHERE active=1", function (err, categoryInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }
        if (categoryInfo) {
            categoryInfo.forEach((catdt, idx) => {
                db.query("SELECT id FROM instructor_course WHERE category_id='" + catdt.id + "' and course_status='Public' ", function (err, catCount) {
                    if (err) {
                        console.log("rows=====list of users=errrr====", err);
                        var err = new Error("Something went wrong");
                    }
                    if (catCount) {
                        catdt.catCount = catCount.length;
                        if (idx === categoryInfo.length - 1) {
                            console.log("rows=====list of categoryInfo=====", categoryInfo);
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send(categoryInfo);
                        }
                    }
                })
            })

        }

    });
});


router.get('/getCategoryListMaster', function (req, res) {
    db.query("SELECT * FROM course_category", function (err, categoryInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }
        if (categoryInfo) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(categoryInfo);
        }

    });
});


router.post('/getSubCategoryList', function (req, res) {
    var cat = req.body.cat;
    db.query("SELECT * FROM course_subcategory WHERE category_id='" + cat + "'", function (err, categoryInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }
        if (categoryInfo) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(categoryInfo);
        }

    });
});


router.get('/getSubCategoryListMaster', function (req, res) {
    db.query("SELECT a.*,b.category FROM course_subcategory a JOIN course_category b ON a.category_id=b.id", function (err, categoryInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }
        if (categoryInfo) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(categoryInfo);
        }

    });
});


router.get('/getCourseLevelList', function (req, res) {
    db.query("SELECT * FROM course_level", function (err, levelInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }
        if (levelInfo) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(levelInfo);
        }

    });
});

router.post('/getCoursesPerCategory', function (req, res) {
    var categoryInfo = req.body.categoryInfo;
    var authToken = req.body.authToken;
    var fromLimit= (categoryInfo.page * categoryInfo.itemsPerPage);
    var toLimit = categoryInfo.itemsPerPage;
    console.log("categoryInfo===", categoryInfo);
    db.query("SELECT a.*,b.user_name,c.category,d.name as level FROM instructor_course a JOIN user_details b ON a.category_id='" + categoryInfo.id + "' and a.course_status='Public' and a.user_id=b.id JOIN course_category c ON a.category_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+"", function (err, courseInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }else{
            if(courseInfo){
                var idx = 0;
                function courseCallBack() {
                    async.eachOfSeries(courseInfo,()=> {
                        coursedt = courseInfo[idx];
                        db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                            if (err) {
                                console.log("Problem with MySQL productcatalog", err);
                            } else {
                                console.log("ratingDt----",ratingDt);
                                coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                db.query("SELECT COUNT(*) as total FROM instructor_course_lectures  WHERE course_id='"+coursedt.id+"' GROUP BY course_id", async (err, lectureCount)=> {
                                    if(err){
                                        console.log("Problem with MySQL productcatalog", err);
                                    }else{
                                        coursedt.totalLectures = (lectureCount.length > 0 ? lectureCount[0].total : 0)
                                        if(authToken){
                                            db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, cartInfo)=> {
                                                if(err){
                                                    console.log("Problem with MySQL productcatalog", err);
                                                }else{
                                                    console.log("coursedt===",cartInfo);
                                                    coursedt.cart_status = await (cartInfo.length > 0 ? cartInfo[0].cart_status : 'Add To Cart')
                                                    //  await (cartInfo.length > 0 ? (cartInfo[0].cart_status == 'Open' ? 'Go to Cart' :(cartInfo[0].cart_status == 'Closed' ? '' : 'Add to Cart')):'Add to Cart')
                                                    db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, wishInfo)=> {
                                                        if(err){
                                                            console.log("Problem with MySQL productcatalog", err);
                                                        }else{
                                                            console.log("wishInfo===",wishInfo);
                                                            coursedt.wishStatus = await (wishInfo.length > 0 ? (wishInfo[0].status ? wishInfo[0].status : 0) : 0)
                                                        
                                                                    idx++;
                                                                    if(idx === courseInfo.length){
                                                                        db.query("SELECT a.id FROM instructor_course a WHERE a.category_id='" + categoryInfo.id + "' and a.course_status='Public'", function (err, catCount) {
                                                                            if (err) {
                                                                                console.log("Problem with MySQL productcatalog", err);
                                                                            } else {
                                                                                res.setHeader('Content-Type', 'application/json');
                                                                                res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                                            }
                                                                        })
                                                                    }else{
                                                                        courseCallBack();
                                                                    }
                                                                
                                                        }
                                                    })
                                                }
                                                })
                                        }else{
                                            coursedt.cart_status = 'Add to Cart';
                                            coursedt.wishStatus = 0;
                                            idx++;
                                            if(idx === courseInfo.length){
                                                db.query("SELECT a.id FROM instructor_course a WHERE a.category_id='" + categoryInfo.id + "' and a.course_status='Public'", function (err, catCount) {
                                                if (err) {
                                                    console.log("Problem with MySQL productcatalog", err);
                                                } else {
                                                    res.setHeader('Content-Type', 'application/json');
                                                    res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                }
                                            })
                                            }else{
                                                courseCallBack();
                                            }
                                        }
                                    }
                                })
                            }
                        })
                    })
                }
                courseCallBack();
            }
        }
   
    });
});



router.post('/getSubCategoryListCount', function (req, res) {
    var categoryInfo = req.body.cat;
    db.query("SELECT a.id, a.subcategory, COUNT(b.id) AS cnt FROM course_subcategory a LEFT JOIN instructor_course b ON b.subcategory_id = a.id and b.course_status='Public' WHERE a.category_id='"+categoryInfo+"' GROUP BY a.id", function (err, subCatData) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }
        if (subCatData) {
            res.setHeader('Content-Type', 'application/json');
           res.status(200).send({'subCatData':subCatData});
            
        }

    });
});


router.post('/getLevelListCount', function (req, res) {
    var categoryInfo = req.body.cat;
        db.query("SELECT a.id, a.name as level, COUNT(b.id) AS count FROM course_level a LEFT JOIN instructor_course b ON b.course_level = a.id and b.category_id='"+categoryInfo+"' and  b.course_status='Public' GROUP BY a.id", function (err, levelInfo) {
            if (err) {
                console.log("rows=====list of users=errrr====", err);
                var err = new Error("Something went wrong");
            }
            if (levelInfo) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({'levelInfo':levelInfo});
            }
        })
});


router.post('/getLevelListCountForSubCat', function (req, res) {
    var categoryInfo = req.body.cat;
        db.query("SELECT a.id, a.name as level, COUNT(b.id) AS count FROM course_level a LEFT JOIN instructor_course b ON b.course_level = a.id and b.subcategory_id='"+categoryInfo+"' and  b.course_status='Public' GROUP BY a.id", function (err, levelInfo) {
            if (err) {
                console.log("rows=====list of users=errrr====", err);
                var err = new Error("Something went wrong");
            }
            if (levelInfo) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({'levelInfo':levelInfo});
            }
        })
});

router.post('/getFilteredCourseDetails', function (req, res) {
    var filterObj = req.body.filterObj;
    var authToken = req.body.authToken;
    var fromLimit= (filterObj.page * filterObj.itemsPerPage);
    var toLimit = filterObj.itemsPerPage;
    console.log("filterObj===", filterObj);
    var q1="";
    var q2="";
    var q3="";
    var q4="";
    if(filterObj['rating']){
        if(filterObj['rating'] && filterObj['sub_category'].length > 0 && filterObj['level'].length > 0){
            q3="SELECT k.*,c.user_name,d.category,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.subcategory_id IN ("+filterObj.sub_category+") and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_category d ON k.category_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+""
            q4="SELECT k.id FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.subcategory_id IN ("+filterObj.sub_category+") and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k WHERE k.averageRating >= '"+filterObj['rating']+"'"
        }else if(filterObj['rating'] && filterObj['sub_category'].length == 0 && filterObj['level'].length == 0){
            q3="SELECT k.*,c.user_name,d.category,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_category d ON k.category_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+""
            q4 ="SELECT k.id FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k WHERE k.averageRating >= '"+filterObj['rating']+"'"
        }else if(filterObj['rating'] && filterObj['sub_category'].length > 0 && filterObj['level'].length == 0){
            q3="SELECT k.*,c.user_name,d.category,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.subcategory_id IN ("+filterObj.sub_category+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_category d ON k.category_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+""
            q4=" SELECT k.id FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.subcategory_id IN ("+filterObj.sub_category+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k WHERE k.averageRating >= '"+filterObj['rating']+"'"
        }else if(filterObj['rating'] && filterObj['sub_category'].length == 0 && filterObj['level'].length > 0){
            console.log("SELECT k.*,c.user_name,d.category,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_category d ON k.category_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+"")
            q3="SELECT k.*,c.user_name,d.category,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_category d ON k.category_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+""
            q4="SELECT k.id FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.category_id='" + filterObj.id + "' and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k WHERE k.averageRating >= '"+filterObj['rating']+"'"
        }
        db.query(q3, function (err, courseInfo) {
            if (err) {
                console.log("rows=====list of users=errrr====", err);
                var err = new Error("Something went wrong");
            }else{
                if(courseInfo){
                    var idx = 0;
                    function courseCallBack() {
                        async.eachOfSeries(courseInfo,()=> {
                            coursedt = courseInfo[idx];
                            db.query("SELECT COUNT(*) as total FROM instructor_course_lectures  WHERE course_id='"+coursedt.id+"' GROUP BY course_id", async (err, lectureCount)=> {
                                if(err){
                                    console.log("Problem with MySQL productcatalog", err);
                                }else{
                                    coursedt.totalLectures = (lectureCount.length > 0 ? lectureCount[0].total : 0)
                                    if(authToken){
                                        db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, cartInfo)=> {
                                            if(err){
                                                console.log("Problem with MySQL productcatalog", err);
                                            }else{
                                                console.log("coursedt===",cartInfo);
                                                coursedt.cart_status = await (cartInfo.length > 0 ? cartInfo[0].cart_status : 'Add To Cart')
                                                //  await (cartInfo.length > 0 ? (cartInfo[0].cart_status == 'Open' ? 'Go to Cart' :(cartInfo[0].cart_status == 'Closed' ? '' : 'Add to Cart')):'Add to Cart')
                                                db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, wishInfo)=> {
                                                    if(err){
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    }else{
                                                        console.log("wishInfo===",wishInfo);
                                                        coursedt.wishStatus = await (wishInfo.length > 0 ? (wishInfo[0].status ? wishInfo[0].status : 0) : 0)
                                                    
                                                                idx++;
                                                                if(idx === courseInfo.length){
                                                                    db.query(q4, function (err, catCount) {
                                                                        if (err) {
                                                                            console.log("Problem with MySQL productcatalog", err);
                                                                        } else {
                                                                            res.setHeader('Content-Type', 'application/json');
                                                                            res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                                        }
                                                                    })
                                                                }else{
                                                                    courseCallBack();
                                                                }
                                                            }
                                                        }) 
                                                    
                                            }
                                            })
                                    }else{
                                        coursedt.cart_status = 'Add to Cart';
                                        coursedt.wishStatus = 0;
                                        idx++;
                                        if(idx === courseInfo.length){
                                            db.query(q2, function (err, catCount) {
                                            if (err) {
                                                console.log("Problem with MySQL productcatalog", err);
                                            } else {
                                                console.log("catCount.length===",catCount.length);
                                                res.setHeader('Content-Type', 'application/json');
                                                res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                            }
                                            })
                                        }else{
                                            courseCallBack();
                                        }
                                    }
                                }
                            })
                                
                        })
                    }
                    courseCallBack();
                }
            }
       
        });
    }else{
        if(filterObj['sub_category'].length > 0 && filterObj['level'].length > 0){
            console.log("111111111111111111111")
            q1="SELECT a.*,b.user_name,c.category,d.name as level FROM instructor_course a JOIN user_details b ON a.category_id='" + filterObj.id + "' and a.subcategory_id IN ("+filterObj.sub_category+") and a.course_level IN ("+filterObj.level+") and a.course_status='Public' and a.user_id=b.id JOIN course_category c ON a.category_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+""
            q2="SELECT a.id FROM instructor_course a WHERE a.category_id='" + filterObj.id + "' and a.subcategory_id IN ("+filterObj.sub_category+") and a.course_level IN ("+filterObj.level+") and a.course_status='Public'"
        }else if(filterObj['sub_category'].length == 0 && filterObj['level'].length > 0){
            q1="SELECT a.*,b.user_name,c.category,d.name as level FROM instructor_course a JOIN user_details b ON a.category_id='" + filterObj.id + "' and a.course_level IN ("+filterObj.level+") and a.course_status='Public' and a.user_id=b.id JOIN course_category c ON a.category_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+""
            q2="SELECT a.id FROM instructor_course a WHERE a.category_id='" + filterObj.id + "' and a.course_level IN ("+filterObj.level+") and a.course_status='Public'";
        }else if(filterObj['sub_category'].length > 0 && filterObj['level'] == 0){
            q1="SELECT a.*,b.user_name,c.category,d.name as level FROM instructor_course a JOIN user_details b ON a.category_id='" + filterObj.id + "' and a.subcategory_id IN ("+filterObj.sub_category+") and a.course_status='Public' and a.user_id=b.id JOIN course_category c ON a.category_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+""
            q2="SELECT a.id FROM instructor_course a WHERE a.category_id='" + filterObj.id + "' and a.subcategory_id IN ("+filterObj.sub_category+") and a.course_status='Public'"
        }
        db.query(q1, function (err, courseInfo) {
            if (err) {
                console.log("rows=====list of users=errrr====", err);
                var err = new Error("Something went wrong");
            }else{
                if(courseInfo){
                    var idx = 0;
                    function courseCallBack() {
                        async.eachOfSeries(courseInfo,()=> {
                            coursedt = courseInfo[idx];
                            db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    console.log("ratingDt----",ratingDt);
                                    coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                    coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                     db.query("SELECT COUNT(*) as total FROM instructor_course_lectures  WHERE course_id='"+coursedt.id+"' GROUP BY course_id", async (err, lectureCount)=> {
                                        if(err){
                                            console.log("Problem with MySQL productcatalog", err);
                                        }else{
                                            coursedt.totalLectures = (lectureCount.length > 0 ? lectureCount[0].total : 0)
                                            if(authToken){
                                                db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, cartInfo)=> {
                                                    if(err){
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    }else{
                                                        console.log("coursedt===",cartInfo);
                                                        coursedt.cart_status = await (cartInfo.length > 0 ? cartInfo[0].cart_status : 'Add To Cart')
                                                        //  await (cartInfo.length > 0 ? (cartInfo[0].cart_status == 'Open' ? 'Go to Cart' :(cartInfo[0].cart_status == 'Closed' ? '' : 'Add to Cart')):'Add to Cart')
                                                        db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, wishInfo)=> {
                                                            if(err){
                                                                console.log("Problem with MySQL productcatalog", err);
                                                            }else{
                                                                console.log("wishInfo===",wishInfo);
                                                            
                                                                        idx++;
                                                                        if(idx === courseInfo.length){
                                                                            db.query(q2, function (err, catCount) {
                                                                                if (err) {
                                                                                    console.log("Problem with MySQL productcatalog", err);
                                                                                } else {
                                                                                    res.setHeader('Content-Type', 'application/json');
                                                                                    res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                                                }
                                                                            })
                                                                        }else{
                                                                            courseCallBack();
                                                                        }
                                                                    }
                                                                }) 
                                                        
                                                    }
                                                    })
                                            }else{
                                                coursedt.cart_status = 'Add to Cart';
                                                coursedt.wishStatus = 0;
                                                idx++;
                                                if(idx === courseInfo.length){
                                                    db.query(q2, function (err, catCount) {
                                                    if (err) {
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    } else {
                                                        console.log("catCount.length===",catCount.length);
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                    }
                                                })
                                                }else{
                                                    courseCallBack();
                                                }
                                            }
                                        }
                                    })
                                }
                            })
                        })
                    }
                    courseCallBack();
                }
            }
       
        });
    }
    
});


router.post('/getFilteredSubCatCourseDetails', function (req, res) {
    var filterObj = req.body.filterObj;
    var authToken = req.body.authToken;
    var fromLimit= (filterObj.page * filterObj.itemsPerPage);
    var toLimit = filterObj.itemsPerPage;
    console.log("filterObj===", filterObj);
    var q1="";
    var q2="";
    var q3="";
    var q4="";
    if(filterObj['rating']){
        if(filterObj['rating'] && filterObj['level'].length > 0){
            q3="SELECT k.*,c.user_name,d.subcategory,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.subcategory_id='" + filterObj.id + "' and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_subcategory d ON k.subcategory_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+""
            q4="SELECT k.id FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.subcategory_id='" + filterObj.id + "' and b.course_level IN ("+filterObj.level+") and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k WHERE k.averageRating >= '"+filterObj['rating']+"'"
        }else if(filterObj['rating']  && filterObj['level'].length == 0){
            q3="SELECT k.*,c.user_name,d.subcategory,e.name as level FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.subcategory_id='" + filterObj.id + "' and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k JOIN user_details c ON k.averageRating >= '"+filterObj['rating']+"' and k.user_id=c.id JOIN course_subcategory d ON k.subcategory_id=d.id LEFT JOIN course_level e ON k.course_level=e.id LIMIT "+fromLimit+","+toLimit+""
            q4 ="SELECT k.id FROM (SELECT avg(a.rating) averageRating,count(*) ratingCount,a.course_id,b.* FROM student_cart_details a JOIN instructor_course b ON a.course_id=b.id and b.subcategory_id='" + filterObj.id + "' and b.course_status='Public' and a.instructor_id=b.user_id and rating IS NOT NULL group by course_id,instructor_id) k WHERE k.averageRating >= '"+filterObj['rating']+"'"
        }
        db.query(q3, function (err, courseInfo) {
            if (err) {
                console.log("rows=====list of users=errrr====", err);
                var err = new Error("Something went wrong");
            }else{
                if(courseInfo){
                    var idx = 0;
                    function courseCallBack() {
                        async.eachOfSeries(courseInfo,()=> {
                            coursedt = courseInfo[idx];
                            db.query("SELECT COUNT(*) as total FROM instructor_course_lectures  WHERE course_id='"+coursedt.id+"' GROUP BY course_id", async (err, lectureCount)=> {
                                if(err){
                                    console.log("Problem with MySQL productcatalog", err);
                                }else{
                                    coursedt.totalLectures = (lectureCount.length > 0 ? lectureCount[0].total : 0)
                                    if(authToken){
                                        db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, cartInfo)=> {
                                            if(err){
                                                console.log("Problem with MySQL productcatalog", err);
                                            }else{
                                                console.log("coursedt===",cartInfo);
                                                coursedt.cart_status = await (cartInfo.length > 0 ? cartInfo[0].cart_status : 'Add To Cart')
                                                //  await (cartInfo.length > 0 ? (cartInfo[0].cart_status == 'Open' ? 'Go to Cart' :(cartInfo[0].cart_status == 'Closed' ? '' : 'Add to Cart')):'Add to Cart')
                                                db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, wishInfo)=> {
                                                    if(err){
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    }else{
                                                        console.log("wishInfo===",wishInfo);
                                                        coursedt.wishStatus = await (wishInfo.length > 0 ? (wishInfo[0].status ? wishInfo[0].status : 0) : 0)
                                                    
                                                                idx++;
                                                                if(idx === courseInfo.length){
                                                                    db.query(q4, function (err, catCount) {
                                                                        if (err) {
                                                                            console.log("Problem with MySQL productcatalog", err);
                                                                        } else {
                                                                            res.setHeader('Content-Type', 'application/json');
                                                                            res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                                        }
                                                                    })
                                                                }else{
                                                                    courseCallBack();
                                                                }
                                                            }
                                                        }) 
                                                    
                                            }
                                            })
                                    }else{
                                        coursedt.cart_status = 'Add to Cart';
                                        coursedt.wishStatus = 0;
                                        idx++;
                                        if(idx === courseInfo.length){
                                            db.query(q2, function (err, catCount) {
                                            if (err) {
                                                console.log("Problem with MySQL productcatalog", err);
                                            } else {
                                                console.log("catCount.length===",catCount.length);
                                                res.setHeader('Content-Type', 'application/json');
                                                res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                            }
                                            })
                                        }else{
                                            courseCallBack();
                                        }
                                    }
                                }
                            })
                                
                        })
                    }
                    courseCallBack();
                }
            }
       
        });
    }else{
        if(filterObj['level'].length > 0){
            console.log("111111111111111111111")
            q1="SELECT a.*,b.user_name,c.subcategory,d.name as level FROM instructor_course a JOIN user_details b ON a.subcategory_id='" + filterObj.id + "' and a.course_level IN ("+filterObj.level+") and a.course_status='Public' and a.user_id=b.id JOIN course_subcategory c ON a.subcategory_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+""
            q2="SELECT a.id FROM instructor_course a WHERE a.subcategory_id='" + filterObj.id + "' and a.course_level IN ("+filterObj.level+") and a.course_status='Public'"
        }
        db.query(q1, function (err, courseInfo) {
            if (err) {
                console.log("rows=====list of users=errrr====", err);
                var err = new Error("Something went wrong");
            }else{
                if(courseInfo){
                    var idx = 0;
                    function courseCallBack() {
                        async.eachOfSeries(courseInfo,()=> {
                            coursedt = courseInfo[idx];
                            db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    console.log("ratingDt----",ratingDt);
                                    coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                    coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                     db.query("SELECT COUNT(*) as total FROM instructor_course_lectures  WHERE course_id='"+coursedt.id+"' GROUP BY course_id", async (err, lectureCount)=> {
                                        if(err){
                                            console.log("Problem with MySQL productcatalog", err);
                                        }else{
                                            coursedt.totalLectures = (lectureCount.length > 0 ? lectureCount[0].total : 0)
                                            if(authToken){
                                                db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, cartInfo)=> {
                                                    if(err){
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    }else{
                                                        console.log("coursedt===",cartInfo);
                                                        coursedt.cart_status = await (cartInfo.length > 0 ? cartInfo[0].cart_status : 'Add To Cart')
                                                        //  await (cartInfo.length > 0 ? (cartInfo[0].cart_status == 'Open' ? 'Go to Cart' :(cartInfo[0].cart_status == 'Closed' ? '' : 'Add to Cart')):'Add to Cart')
                                                        db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", async (err, wishInfo)=> {
                                                            if(err){
                                                                console.log("Problem with MySQL productcatalog", err);
                                                            }else{
                                                                console.log("wishInfo===",wishInfo);
                                                            
                                                                        idx++;
                                                                        if(idx === courseInfo.length){
                                                                            db.query(q2, function (err, catCount) {
                                                                                if (err) {
                                                                                    console.log("Problem with MySQL productcatalog", err);
                                                                                } else {
                                                                                    res.setHeader('Content-Type', 'application/json');
                                                                                    res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                                                }
                                                                            })
                                                                        }else{
                                                                            courseCallBack();
                                                                        }
                                                                    }
                                                                }) 
                                                        
                                                    }
                                                    })
                                            }else{
                                                coursedt.cart_status = 'Add to Cart';
                                                coursedt.wishStatus = 0;
                                                idx++;
                                                if(idx === courseInfo.length){
                                                    db.query(q2, function (err, catCount) {
                                                    if (err) {
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    } else {
                                                        console.log("catCount.length===",catCount.length);
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                    }
                                                })
                                                }else{
                                                    courseCallBack();
                                                }
                                            }
                                        }
                                    })
                                }
                            })
                        })
                    }
                    courseCallBack();
                }
            }
       
        });
    }
    
});

router.post('/getCoursesPerSubCategory', function (req, res) {
    var categoryInfo = req.body.categoryInfo;
    var authToken = req.body.authToken;
    var fromLimit= (categoryInfo.page * categoryInfo.itemsPerPage);
    var toLimit = categoryInfo.itemsPerPage;
    console.log("categoryInfo===", categoryInfo);
    db.query("SELECT a.*,b.user_name,c.subcategory,d.name as level FROM instructor_course a JOIN user_details b ON a.subcategory_id='" + categoryInfo.id + "' and a.course_status='Public' and a.user_id=b.id JOIN course_subcategory c ON a.subcategory_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+"", function (err, courseInfo) {
        if (err) {
            console.log("rows=====list of users=errrr====", err);
            var err = new Error("Something went wrong");
        }else{
            if(courseInfo.length > 0){
                var idx = 0;
                function courseCallBack() {
                    async.eachOfSeries(courseInfo,()=> {
                        coursedt = courseInfo[idx];
                        db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                            if (err) {
                                console.log("Problem with MySQL productcatalog", err);
                            } else {
                                console.log("ratingDt----",ratingDt);
                                coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                db.query("SELECT COUNT(*) as total FROM instructor_course_lectures  WHERE course_id='"+coursedt.id+"' GROUP BY course_id", async (err, lectureCount)=> {
                                    if(err){
                                        console.log("Problem with MySQL productcatalog", err);
                                    }else{
                                        coursedt.totalLectures = (lectureCount.length > 0 ? lectureCount[0].total : 0)
                                        if(authToken){
                                            db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", function (err, cartInfo) {
                                                if(err){
                                                    console.log("Problem with MySQL productcatalog", err);
                                                }else{
                                                    console.log("coursedt===",cartInfo);
                                                    coursedt.cart_status = (cartInfo.length > 0 ? cartInfo[0].cart_status : 'Add To Cart')
                                                    db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", function (err, wishInfo) {
                                                        if(err){
                                                            console.log("Problem with MySQL productcatalog", err);
                                                        }else{
                                                            console.log("wishInfo===",wishInfo);
                                                            coursedt.wishStatus = (wishInfo.length > 0 ? (wishInfo[0].status ? wishInfo[0].status : 0) : 0)
                                                            idx++;
                                                            if(idx === courseInfo.length){
                                                                db.query("SELECT a.id FROM instructor_course a WHERE a.subcategory_id='" + categoryInfo.id + "' and a.course_status='Public'", function (err, catCount) {
                                                                    if (err) {
                                                                        console.log("Problem with MySQL productcatalog", err);
                                                                    } else {
                                                                        res.setHeader('Content-Type', 'application/json');
                                                                        res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                                    }
                                                                })
                                                            }else{
                                                                courseCallBack();
                                                            }
                                                        }
                                                    }) 
                                                        
                                                }
                                                })
                                        }else{
                                            coursedt.cart_status = 'Add to Cart';
                                            coursedt.wishStatus = 0;
                                            idx++;
                                            if(idx === courseInfo.length){
                                                db.query("SELECT a.id FROM instructor_course a WHERE a.category_id='" + categoryInfo.id + "' and a.course_status='Public'", function (err, catCount) {
                                                if (err) {
                                                    console.log("Problem with MySQL productcatalog", err);
                                                } else {
                                                    res.setHeader('Content-Type', 'application/json');
                                                    res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                                                }
                                            })
                                            }else{
                                                courseCallBack();
                                            }
                                        }
                                    }
                                })
                            }
                        })
                    })
                }
                courseCallBack();
            }else{
                db.query("SELECT a.id FROM instructor_course a WHERE a.subcategory_id='" + categoryInfo.id + "' and a.course_status='Public'", function (err, catCount) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({'courseInfo':courseInfo,'catCount':catCount.length});
                    }
                })
            }
        }
    });
});

router.post('/setCourseIntendorInfo', function (req, res) {
    var authToken = req.body.authToken;
    var courseId = req.body.courseId;
    var courseInfo = req.body.courseInfo
    console.log("userData====", courseId, courseInfo);
    db.query("DELETE FROM instructor_course_objective WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + courseId + "'", function (err, delObj) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            courseInfo.courseObjective.forEach((objective, idx) => {
                db.query("INSERT INTO instructor_course_objective (user_id,course_id,objective) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseId + "','" + objective + "')", function (err, setobj) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        if (idx === courseInfo.courseObjective.length - 1) {
                            db.query("DELETE FROM instructor_course_requirements WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + courseId + "'", function (err, delReq) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    courseInfo.courseRequirement.forEach((requirement, idx1) => {
                                        db.query("INSERT INTO instructor_course_requirements (user_id,course_id,requirement) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseId + "','" + requirement + "')", function (err, setreq) {
                                            if (err) {
                                                console.log("Problem with MySQL productcatalog", err);
                                            } else {
                                                if (idx1 === courseInfo.courseRequirement.length - 1) {
                                                    db.query("DELETE FROM instructor_coursefor WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + courseId + "'", function (err, delCFor) {
                                                        if (err) {
                                                            console.log("Problem with MySQL productcatalog", err);
                                                        } else {
                                                            courseInfo.courseFor.forEach((course, idx2) => {
                                                                db.query("INSERT INTO instructor_coursefor (user_id,course_id,coursefor) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseId + "','" + course + "')", function (err, setcse) {
                                                                    if (err) {
                                                                        console.log("Problem with MySQL productcatalog", err);
                                                                    } else {
                                                                        if (idx2 === courseInfo.courseFor.length - 1) {
                                                                            res.setHeader('Content-Type', 'application/json');
                                                                            res.status(200).send({ 'status': 'Success' });
                                                                        }

                                                                    }
                                                                });
                                                            })
                                                        }
                                                    })
                                                }

                                            }
                                        });
                                    })
                                }
                            })
                        }

                    }
                });
            })
        }
    })

});


router.post('/getCourseInfo', function (req, res) {
    var courseId = req.body.courseId;
    console.log("courseId====", courseId);
    db.query("SELECT a.*,b.category FROM instructor_course a JOIN course_category b ON a.id='" + courseId + "' and a.category_id=b.id", function (err, courseInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT objective FROM instructor_course_objective WHERE course_id='" + courseId + "'", function (err, courseObjective) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    db.query("SELECT requirement FROM instructor_course_requirements WHERE course_id='" + courseId + "'", function (err, courseReq) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            db.query("SELECT coursefor FROM instructor_coursefor WHERE course_id='" + courseId + "'", function (err, courseFor) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    console.log("courseObjective====", courseObjective);
                                    res.setHeader('Content-Type', 'application/json');
                                    res.status(200).send({ 'courseInfo': courseInfo, 'courseObjective': courseObjective, 'courseReq': courseReq, 'courseFor': courseFor });
                                }
                            })
                        }
                    })
                }
            })
        }
    })
});


router.post('/getCourseDetailedView', function (req, res) {
    var courseId = req.body.courseId;
    console.log("courseId====", courseId);
    db.query("SELECT a.*,b.category FROM instructor_course a JOIN course_category b ON a.id='" + courseId + "' and a.category_id=b.id", function (err, courseInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(courseInfo){
                courseInfo.forEach((coursedt,idx)=>{
                    coursedt['ratingSum']=0;
                    coursedt['ratingCount']=0;
                    coursedt['reviewCount']=0;
                    db.query("SELECT * FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"'", function (err, cartDt) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            console.log("cartDt=====",cartDt);
                            if(cartDt.length > 0){
                                for(i=0;i<cartDt.length;i++){
                                    if(cartDt[i].rating != null){
                                        coursedt['ratingSum'] = Number(coursedt['ratingSum'])+Number(cartDt[i].rating);
                                        coursedt['ratingCount']++;
                                    }
                                    if(cartDt[i].review != null){
                                        coursedt['reviewCount']++;
                                    }
                                }
                            }
                            if(idx === courseInfo.length - 1){
                                db.query("SELECT objective FROM instructor_course_objective WHERE course_id='" + courseId + "'", function (err, courseObjective) {
                                    if (err) {
                                        console.log("Problem with MySQL productcatalog", err);
                                    } else {
                                        db.query("SELECT requirement FROM instructor_course_requirements WHERE course_id='" + courseId + "'", function (err, courseReq) {
                                            if (err) {
                                                console.log("Problem with MySQL productcatalog", err);
                                            } else {
                                                db.query("SELECT coursefor FROM instructor_coursefor WHERE course_id='" + courseId + "'", function (err, courseFor) {
                                                    if (err) {
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    } else {
                                                        db.query("SELECT b.* FROM instructor_course a JOIN user_details b ON a.id='" + courseId + "' and a.user_id=b.id", function (err, instructorInfo) {
                                                            if (err) {
                                                                console.log("Problem with MySQL productcatalog", err);
                                                            } else {
                                                                console.log("courseObjective====", courseObjective);
                                                                res.setHeader('Content-Type', 'application/json');
                                                                res.status(200).send({ 'courseInfo': courseInfo, 'courseObjective': courseObjective, 'courseReq': courseReq, 'courseFor': courseFor, 'instructorInfo': instructorInfo });
                                                            }
                                                        })
                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        }
                    })
                })
            }
        }
        
    })
    
});

router.post('/getCoursesList', function (req, res) {
    var authToken=req.body.authToken;
    db.query("SELECT a.*,b.user_name,c.category FROM instructor_course a JOIN user_details b ON a.course_status='Public' and a.user_id=b.id JOIN course_category c ON a.category_id=c.id ORDER BY a.id DESC", function (err, courseInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(courseInfo){
                var idx = 0;
                function courseCallBack() {
                    async.eachOfSeries(courseInfo,()=> {
                        coursedt = courseInfo[idx];
                        db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                            if (err) {
                                console.log("Problem with MySQL productcatalog", err);
                            } else {
                                console.log("ratingDt----",ratingDt);
                                coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                if(authToken){
                                    db.query("SELECT a.cart_status FROM student_cart_details a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", function (err, cartInfo) {
                                        if(err){
                                            console.log("Problem with MySQL productcatalog", err);
                                        }else{
                                            console.log("coursedt===",cartInfo);
                                            coursedt.funcName = (cartInfo.length > 0 ? (cartInfo[0].cart_status == 'Open' ? 'Go to Cart' :(cartInfo[0].cart_status == 'Closed' ? '' : 'Add to Cart')):'Add to Cart')
                                            db.query("SELECT a.status FROM course_wishlist a WHERE a.course_id='"+coursedt.id+"' and a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", function (err, wishInfo) {
                                                if(err){
                                                    console.log("Problem with MySQL productcatalog", err);
                                                }else{
                                                    console.log("wishInfo===",wishInfo);
                                                    coursedt.wishStatus = (wishInfo.length > 0 ? (wishInfo[0].status ? wishInfo[0].status : 0) : 0)
                                                    idx++;
                                                    if(idx === courseInfo.length){
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.status(200).send({'courseInfo':courseInfo});
                                                            
                                                    }else{
                                                        courseCallBack();
                                                    }
                                                }
                                            }) 
                                        }
                                        })
                                }else{
                                    coursedt.funcName = 'Add to Cart';
                                    coursedt.wishStatus = 0;
                                    idx++;
                                    if(idx === courseInfo.length){
                                        res.setHeader('Content-Type', 'application/json');
                                        res.status(200).send({'courseInfo':courseInfo});
                                    }else{
                                        courseCallBack();
                                    }
                                }
                            }
                        })
                    })
                }
                courseCallBack();
            }

        }
    })
});

router.post('/getCoursesListPerUser', function (req, res) {
    var authToken = req.body.authToken;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    console.log("authToken====", authToken,pageInfo)
    db.query("SELECT a.*,b.user_name,c.category FROM instructor_course a JOIN user_details b ON a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and a.user_id=b.id JOIN course_category c ON a.category_id=c.id LIMIT "+fromLimit+","+toLimit+"", function (err, courseInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT a.id,b.user_name FROM instructor_course a JOIN user_details b ON a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and a.user_id=b.id", function (err, courseCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    console.log("courseCount===", courseCount);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({ 'courseInfo': courseInfo, 'courseCount':courseCount.length });
                }
            })
        }
    })
});


router.post('/editCourseInfo', function (req, res) {
    var courseDt = req.body.courseDt;
    console.log("courseDt====", courseDt)
    db.query("SELECT * FROM instructor_course WHERE id='" + courseDt.id + "'", function (err, courseInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT objective FROM instructor_course_objective WHERE course_id='" + courseDt.id + "' and user_id='" + courseDt.user_id + "'", function (err, courseObjective) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    db.query("SELECT requirement FROM instructor_course_requirements WHERE course_id='" + courseDt.id + "' and user_id='" + courseDt.user_id + "'", function (err, courseReq) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            db.query("SELECT coursefor FROM instructor_coursefor WHERE course_id='" + courseDt.id + "' and user_id='" + courseDt.user_id + "'", function (err, courseFor) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    console.log("courseObjective====", courseObjective);
                                    res.setHeader('Content-Type', 'application/json');
                                    res.status(200).send({ 'courseInfo': courseInfo, 'courseObjective': courseObjective, 'courseReq': courseReq, 'courseFor': courseFor });
                                }
                            })
                        }
                    })
                }
            })
        }
    })
});


router.post('/setSectionDetails', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sections = req.body.sections;
    console.log("authToken====", authToken)
    db.query("INSERT INTO instructor_course_sections (user_id,course_id,section_title,section_description) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseid + "','" + sections.sec_title + "','" + sections.sec_desc + "')", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});



router.post('/updateSectionDetails', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sections = req.body.sections;
    console.log("authToken====", authToken)
    db.query("UPDATE instructor_course_sections SET user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "'),course_id='" + courseid + "',section_title='" + sections.section_title + "',section_description='" + sections.section_description + "' WHERE id='"+sections.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/deleteSectionInfo', function (req, res) {
    var sec = req.body.sec;
    console.log("sec to del====",sec)
    db.query("UPDATE instructor_course_sections SET is_deleted=1 WHERE id='"+sec.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});

router.post('/deleteLectureInfo', function (req, res) {
    var lect = req.body.lect;
    // console.log("sec to del====",lect)
    db.query("UPDATE instructor_course_lectures SET is_deleted=1 WHERE id='"+lect.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


// 
router.post('/getSectionByCourse', function (req, res) {
    var courseid = req.body.courseid;
    db.query("SELECT * FROM instructor_course_sections WHERE course_id='" + courseid + "' and is_deleted=0", function (err, secData) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if (secData.length > 0) {
                secData.forEach((secdt, idx) => {
                    secdt['lectures'] = [];
                    db.query("SELECT id,user_id,course_id,section_id,lecture_title,lecture_description,video_url as upload_url FROM instructor_course_lectures WHERE course_id='" + courseid + "' and section_id='" + secdt.id + "' and is_deleted=0", function (err, lectureData) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            console.log("lectureData===", lectureData);
                            secdt.lectures = lectureData;
                            if(idx === secData.length - 1){
                                console.log("elssssssssseeee--------idx----------")
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send({ 'data': secData });
                            }
                        }
                    })
                })
            } else {
                console.log("secData=333333333333===",secData);
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({ 'data': secData });
            }

        }
    })
});


router.post('/getResourcesListofLecture', function (req, res) {
    var courseid = req.body.courseid;
    var userid=req.body.userid;
    var sectionId=req.body.sectionId;
     var lectureId=req.body.lectureId;

    db.query("SELECT id,user_id,course_id,section_id,lecture_id,resource_file,resource_file_name FROM instructor_lecture_resources WHERE course_id='" + courseid + "' and section_id='"+sectionId+"' and lecture_id='" + lectureId + "' and is_deleted=0", function (err, resourceData) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
                // console.log("secData=333333333333===",resourceData);
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({ 'data': resourceData });
        }
    })
});


router.post('/deleteResourceInfo', function (req, res) {
    var resoucedt = req.body.resoucedt;
    // console.log("sec to del====",lect)
    db.query("UPDATE instructor_lecture_resources SET is_deleted=1 WHERE id='"+resoucedt.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT * FROM instructor_lecture_resources  WHERE lecture_id='"+resoucedt.lecture_id+"' and is_deleted=0", function (err, resourceCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    if(resourceCount.length > 0){
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({ 'status': 'Success' });
                    }else{
                        db.query("UPDATE instructor_course_lectures SET resource_count=0 WHERE id='"+resoucedt.lecture_id+"'", function (err, resourceCount) {
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
            // UPDATE instructor_course_lectures SET resource_count=1 WHERE course_id='" + courseid + "' and section_id='" + sectionDt.id + "' and lecture_id='"+lectureDt.id+"'
           
        }
    })
});

router.post('/setLectureDetails', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sectionDt = req.body.sectionDt;
    console.log("sectionDt====", sectionDt);

    db.query("INSERT INTO instructor_course_lectures (user_id,course_id,section_id,lecture_title,lecture_description) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseid + "','" + sectionDt.id + "','" + sectionDt.lect_title + "','" + sectionDt.lect_desc + "')", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/updateLectureDetails', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sectionDt = req.body.sectionDt;
    var lectureDt = req.body.lectureDt;
    console.log("sectionDt====", sectionDt);

    db.query("UPDATE instructor_course_lectures SET user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "'),course_id='" + courseid + "',section_id='" + sectionDt.id + "',lecture_title='" + lectureDt.lecture_title + "',lecture_description='" + lectureDt.lecture_description + "' WHERE id='"+lectureDt.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        var baseRoot=req.body.baseRoot;
        var sectionDt=JSON.parse(req.body.section);
        var lectureDt=JSON.parse(req.body.lecture);
        const dest= baseRoot+'/'+ ('section-'+sectionDt.id) + '/' + ('lecture-'+lectureDt.id);
        fs.access(dest, function (error) {
            if (error) {
              console.log("Directory does not exist.");
              return fs.mkdir(dest,{ recursive: true }, (error) => cb(error, dest));
            } else {
              console.log("Directory exists.");
              return cb(null, dest);
            }
          });
    },
    filename: (req, file, cb) => {
        console.log("file---iii---",file);
      cb(null, file.originalname)
    }
  });
  
  let upload = multer({
    storage: storage
  });

router.post('/updateLectureVideo',upload.single('file'), function (req, res) {
    var baseRoot=req.body.baseRoot;
    var courseid = req.body.courseId;
    var sectionDt = JSON.parse(req.body.section);
    var lectureDt = JSON.parse(req.body.lecture);
    const file = req.file;
    var path1 = baseRoot+'/'+ ('section-'+sectionDt.id) + '/' + ('lecture-'+lectureDt.id)+ '/'+file.originalname;
    getVideoDurationInSeconds(urlBase + path1).then((duration) => {
        console.log("duration-----",duration);
        var vidDuration=duration
        var secs = vidDuration % 60;
        vidDuration = (vidDuration - secs) / 60;
        var mins = vidDuration % 60;
        var hrs = (vidDuration - mins) / 60;
        var fixedSec= secs.toFixed();
        var fixedMin= (mins > 0 ? (Number(mins+'.'+fixedSec).toFixed()+'min') : ((fixedSec)+'sec'))
        var fixedhrs= (hrs > 0 ? (Number(hrs+'.'+fixedMin).toFixed()+'hr') :'');
        var finalDuration= (hrs > 0 ? fixedhrs : fixedMin);
        console.log("fixedllll====",finalDuration);
        db.query("UPDATE instructor_course_lectures SET video_url='" + urlBase + path1 + "',lecture_type='FILE',lecture_duration='"+finalDuration+"',file_type='"+file.mimetype+"' WHERE id='"+lectureDt.id+"'", function (err, setSec) {
            if (err) {
                console.log("Problem with MySQL productcatalog", err);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({ 'status': 'Success' });
            }
        })
    })
  
});


router.post('/updateLectureResource',upload.single('file'), function (req, res) {
    var baseRoot=req.body.baseRoot;
    var authToken=req.body.authToken;
    var courseid = req.body.courseId;
    var sectionDt = JSON.parse(req.body.section);
    var lectureDt = JSON.parse(req.body.lecture);
    const file = req.file;
    console.log("file====",file);
    var path1 = baseRoot+'/'+ ('section-'+sectionDt.id) + '/' + ('lecture-'+lectureDt.id)+ '/'+file.originalname;
    db.query("INSERT INTO instructor_lecture_resources (user_id,course_id,section_id,lecture_id,resource_file,resource_file_name) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + courseid + "','" + sectionDt.id + "','"+lectureDt.id+"','"+urlBase + path1+"','"+file.originalname+"')", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("UPDATE instructor_course_lectures SET resource_count=1 WHERE course_id='" + courseid + "' and section_id='" + sectionDt.id + "' and id='"+lectureDt.id+"'", function (err, setSec) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    console.log("upload video===",setSec);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({ 'status': 'Success' });
                }
            })
        }
    })
});

router.post('/updateLectureURL', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sectionDt = req.body.sectionDt;
    var lectureDt = req.body.lectureDt;
    getVideoDurationInSeconds(lectureDt.upload_url).then((duration) => {
        var vidDuration=duration
        var secs = vidDuration % 60;
        vidDuration = (vidDuration - secs) / 60;
        var mins = vidDuration % 60;
        var hrs = (vidDuration - mins) / 60;
        var fixedSec= secs.toFixed();
        var fixedMin= (mins > 0 ? (Number(mins+'.'+fixedSec).toFixed()+'min') : ((fixedSec)+'sec'))
        var fixedhrs= (hrs > 0 ? (Number(hrs+'.'+fixedMin).toFixed()+'hr') :'');
        var finalDuration= (hrs > 0 ? fixedhrs : fixedMin);
        console.log("fixedllll==urllll==",finalDuration);
        db.query("UPDATE instructor_course_lectures SET video_url='" + lectureDt.upload_url+ "',lecture_type='URL',lecture_duration='"+finalDuration+"' WHERE id='"+lectureDt.id+"'", function (err, setSec) {
            if (err) {
                console.log("Problem with MySQL productcatalog", err);
            } else {
                // console.log("setcourse===",courseInfo);
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({ 'status': 'Success' });
            }
        })
    })
});



router.post('/setCourseLandingInfo', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var landingInfo = req.body.landingInfo;
    console.log("landingInfo====", landingInfo)
    db.query("UPDATE instructor_course SET course_title='" + landingInfo.courseTitle + "',course_subtitle='" + landingInfo.courseSubtitle + "',course_description='" + landingInfo.courseDescription + "',course_level='" + landingInfo.courseLevel + "',primary_info='" + landingInfo.primaryInfo + "',category_id='" + landingInfo.primaryCategory + "',subcategory_id='" + landingInfo.subcategory + "',course_image='" + landingInfo.courseImage + "' WHERE id='" + courseid + "'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/setCoursePriceInfo', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var priceinfo = req.body.priceinfo;
    console.log("authToken====", authToken)
    db.query("UPDATE instructor_course SET course_price='" + priceinfo.coursePrice + "' WHERE id='" + courseid + "'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/getAssessmentList', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sectionid = req.body.sectionid;
    var lectureid = req.body.lectureid;
    console.log("authToken====", authToken)
    db.query("SELECT * FROM instructor_lecture_assessment WHERE course_id='"+courseid+"' and section_id='"+sectionid+"' and lecture_id='"+lectureid+"' and is_deleted=0", function (err, assessList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'data':assessList});
        }
    })
});


router.post('/setAssessmentInfo', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var sectionid = req.body.sectionid;
    var lectureid = req.body.lectureid;
    var assessmentDt = req.body.assessmentDt;
    console.log("authToken====", authToken)
    db.query("INSERT INTO instructor_lecture_assessment (user_id,course_id,section_id,lecture_id,question,option1,option2,option3,option4,answer)  VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'"+courseid+"','"+sectionid+"','"+lectureid+"','"+assessmentDt.question+"','"+assessmentDt.option1+"','"+assessmentDt.option2+"','"+assessmentDt.option3+"','"+assessmentDt.option4+"','"+assessmentDt.answer+"')", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/updateAssessmentInfo', function (req, res) {
    var assessmentUpdateDt = req.body.assessmentUpdateDt;
    db.query("UPDATE instructor_lecture_assessment SET question='"+assessmentUpdateDt.question+"',option1='"+assessmentUpdateDt.option1+"',option2='"+assessmentUpdateDt.option2+"',option3='"+assessmentUpdateDt.option3+"',option4='"+assessmentUpdateDt.option4+"',answer='"+assessmentUpdateDt.answer+"' WHERE id='"+assessmentUpdateDt.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});

router.post('/deleteAssessmentInfo', function (req, res) {
    var assessdt = req.body.assessdt;
    // console.log("sec to del====",lect)
    db.query("UPDATE instructor_lecture_assessment SET is_deleted=1 WHERE id='"+assessdt.id+"'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/setAssessmentResult', function (req, res) {
    var videoQueriesList = req.body.videoQueriesList;
    var ansCount = req.body.ansCount;
    var authToken = req.body.authToken;
    console.log("videoQueriesList====ansCount=======",videoQueriesList,ansCount);

    db.query("DELETE FROM instructor_lecture_assessment_result WHERE course_id='"+videoQueriesList[0].course_id+"' and section_id='"+videoQueriesList[0].section_id+"' and lecture_id='"+videoQueriesList[0].lecture_id+"' and instructor_id='"+videoQueriesList[0].user_id+"' and student_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"')", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            videoQueriesList.forEach((assessdt,idx)=>{
                db.query("INSERT INTO instructor_lecture_assessment_result (course_id,section_id,lecture_id,instructor_id,student_id,question_id,stud_option) VALUES ('"+assessdt.course_id+"','"+assessdt.section_id+"','"+assessdt.lecture_id+"','"+assessdt.user_id+"',(SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+assessdt.id+"','"+assessdt.selected+"')", function (err, resdt) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        if(idx === videoQueriesList.length-1){
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send({ 'status': 'Success' });
                        }
                    }
                })
            })
        }
    })
});


router.post('/publishCourse', function (req, res) {
    var authToken = req.body.authToken;
    var courseid = req.body.courseid;
    var priceinfo = req.body.priceinfo;
    console.log("authToken====", authToken)
    db.query("UPDATE instructor_course SET course_status='Public' WHERE id='" + courseid + "'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});

router.post('/getUserCartInfo', function (req, res) {
    var authToken = req.body.authToken;
    console.log("authToken====", authToken);
    db.query("SELECT * FROM student_cart_details WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", function (err, cartInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(cartInfo);
        }
    })
});
router.post('/setAddToCartDetails', function (req, res) {
    var authToken = req.body.authToken;
    var coursedt = req.body.coursedt;
    console.log("authToken====", authToken);
    db.query("SELECT * FROM student_cart_details WHERE user_id = (SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + coursedt.id + "'", function (err, existscart) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } if (existscart) {
            if (existscart.length > 0) {
                db.query("UPDATE student_cart_details SET cart_status='Open' WHERE user_id = (SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + coursedt.id + "'", function (err, setSec) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        // console.log("setcourse===",courseInfo);
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({ 'status': 'Success' });
                    }
                })
            } else {
                db.query("INSERT INTO student_cart_details (user_id,course_id,instructor_id,cart_status) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + coursedt.id + "','" + coursedt.user_id + "','Open')", function (err, setSec) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        // console.log("setcourse===",courseInfo);
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({ 'status': 'Success' });
                    }
                })
            }
        }
    })
});


router.post('/removeFromCartDetails', function (req, res) {
    var authToken = req.body.authToken;
    var cartDt = req.body.cartDt;
    console.log("cartDt====", cartDt);
    db.query("UPDATE student_cart_details set cart_status='Removed' WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + cartDt.id + "'", function (err, cartDt) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(cartDt);
        }
    })
});

router.post('/getAddToCartDetails', function (req, res) {
    var authToken = req.body.authToken;
    console.log("authToken====", authToken);
    db.query("SELECT a.user_id as student_id,b.*,c.category FROM student_cart_details a JOIN instructor_course b ON a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and a.cart_status='Open' and a.course_id=b.id JOIN course_category c ON b.category_id=c.id", function (err, cartDt) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(cartDt);
        }
    })
});


router.post('/setCheckOutDetails', function (req, res) {
    var authToken = req.body.authToken;
    var checkOutDt = req.body.checkOutDt;
    console.log("checkOutDt========", checkOutDt);
    checkOutDt.forEach((checkdt, idx) => {
        db.query("UPDATE student_cart_details SET cart_status='Closed' WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + checkdt.id + "'", function (err, setSec) {
            if (err) {
                console.log("Problem with MySQL productcatalog", err);
            } else {
                if (idx === checkOutDt.length - 1) {
                    // console.log("setcourse===",courseInfo);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({ 'status': 'Success' });
                }

            }
        })
    })
});


router.post('/getMyLearningsList', function (req, res) {
    var authToken = req.body.authToken;
    console.log("checkOutDt========", authToken);
    db.query("SELECT a.rating,a.review,b.*,c.category FROM student_cart_details a JOIN instructor_course b ON a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and a.cart_status='Closed' and a.course_id=b.id JOIN course_category c ON b.category_id=c.id", function (err, learnersList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            learnersList.forEach((courseli, idx) => {
                db.query("SELECT * FROM student_lecture_view_details WHERE student_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + courseli.id + "'", function (err, videoli) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } if (videoli) {
                        courseli.lectureStatus = (videoli.length > 0 ? 'start' : 'new');
                        if (idx === learnersList.length - 1) {
                            // console.log("setcourse===",courseInfo);
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send(learnersList);
                        }

                    }
                })
            })

        }
    })
});


router.post('/getWishList', function (req, res) {
    var authToken = req.body.authToken;
    console.log("checkOutDt========", authToken);
    db.query("SELECT a.status as wishStatus,b.*,c.category FROM course_wishlist a JOIN instructor_course b ON a.user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and a.status=1 and a.course_id=b.id JOIN course_category c ON b.category_id=c.id", function (err, learnersList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            learnersList.forEach((courseli, idx) => {
                db.query("SELECT * FROM student_cart_details WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + courseli.id + "'", function (err, cartDt) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } if (cartDt) {
                        if (cartDt.length > 0) {
                            if (cartDt[0].cart_status == 'Open') {
                                courseli.funcName = 'Go to Cart';
                            } else if (cartDt[0].cart_status == 'Closed') {
                                courseli.funcName = '';
                            } else {
                                courseli.funcName = 'Add to Cart';
                            }
                        } else {
                            courseli.funcName = 'Add to Cart';
                        }
                        if (idx === learnersList.length - 1) {
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send(learnersList);
                        }
                    }
                })
            })

        }
    })
});


router.post('/getLearningVideoToPlay', function (req, res) {
    var authToken = req.body.authToken;
    var learndt = req.body.learndt;
    db.query("SELECT * FROM instructor_course WHERE id='" + learndt.id + "'", function (err, courseData) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT * FROM user_details WHERE authToken='" + authToken + "'", function (err, userinfo) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    db.query("SELECT * FROM user_details WHERE id='" + learndt.user_id + "'", function (err, instructorinfo) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            db.query("SELECT * FROM instructor_coursefor  WHERE course_id='" + learndt.id + "'", function (err, coursefor) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    db.query("SELECT * FROM instructor_course_objective  WHERE course_id='" + learndt.id + "'", function (err, courseObj) {
                                        if (err) {
                                            console.log("Problem with MySQL productcatalog", err);
                                        } else {
                                            db.query("SELECT * FROM instructor_course_requirements  WHERE course_id='" + learndt.id + "'", function (err, courseReq) {
                                                if (err) {
                                                    console.log("Problem with MySQL productcatalog", err);
                                                } else {
                                                    db.query("SELECT a.id,a.section_title,a.section_description FROM instructor_course_sections a WHERE a.course_id='" + learndt.id + "' and a.is_deleted=0", function (err, videoList) {
                                                        if (err) {
                                                            console.log("Problem with MySQL productcatalog", err);
                                                        } else {
                                                            console.log("setcourse===", videoList);
                                                            videoList.forEach((secdt, idx) => {
                                                                secdt['lectures'] = [];
                                                                db.query("SELECT * FROM instructor_course_lectures WHERE course_id='" + learndt.id + "' and section_id='" + secdt.id + "' and is_deleted=0", function (err, lectList) {
                                                                    if (err) {
                                                                        console.log("Problem with MySQL productcatalog", err);
                                                                    } else {
                                                                        secdt['lectures'] = lectList;
                                                                        if (idx === videoList.length - 1) {
                                                                            res.setHeader('Content-Type', 'application/json');
                                                                            res.status(200).send({ 'courseData':courseData,'userinfo': userinfo, 'instructorinfo': instructorinfo, 'coursefor': coursefor, 'courseObj': courseObj, 'courseReq': courseReq, 'videoList': videoList });
                                                                        }
                                                                    }
                                                                })

                                                            })

                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    })
});



router.post('/getInstructorListPerCategory', function (req, res) {
    var catinfo = req.body.catinfo.id;
    db.query("SELECT * FROM user_details WHERE role!=1 and id IN (SELECT DISTINCT user_id FROM instructor_course WHERE category_id='" + catinfo + "') and role != 1", function (err, insList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } if (insList) {
            if (insList.length > 0) {
                insList.forEach((ins, idx) => {
                    db.query("SELECT a.* FROM student_cart_details a JOIN instructor_course b ON b.category_id='" + catinfo + "' and b.user_id='" + ins.id + "' and b.id=a.course_id GROUP BY a.user_id", function (err, studCount) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } if (studCount) {
                            ins.studentCount = studCount.length;
                            ins.studentList=studCount;
                            if (idx === insList.length - 1) {
                                insList.forEach((ins, idx1) => {
                                    db.query("SELECT * FROM instructor_course WHERE category_id='" + catinfo + "' and user_id='" + ins.id + "'", function (err, courCount) {
                                        if (err) {
                                            console.log("Problem with MySQL productcatalog", err);
                                        }
                                        if (courCount) {
                                            ins.courseCount = courCount.length;
                                            if (idx1 === insList.length - 1) {
                                                // console.log("setcourse===",courseInfo);
                                                res.setHeader('Content-Type', 'application/json');
                                                res.status(200).send(insList);
                                            }
                                        }
                                    })
                                })
                            }

                        }
                    })
                })
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(insList);
            }
        }
    })
});


router.post('/getInstructorListPerSubCategory', function (req, res) {
    var catinfo = req.body.catinfo.id;
    console.log("checkOutDt========", "SELECT * FROM user_details WHERE id IN (SELECT DISTINCT user_id FROM instructor_course WHERE category_id='" + catinfo.id + "')");
    db.query("SELECT * FROM user_details WHERE role!=1 and id IN (SELECT DISTINCT user_id FROM instructor_course WHERE subcategory_id='" + catinfo + "')", function (err, insList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } if (insList) {
            if (insList.length > 0) {
                insList.forEach((ins, idx) => {
                    db.query("SELECT a.* FROM student_cart_details a JOIN instructor_course b ON b.subcategory_id='" + catinfo + "' and b.user_id='" + ins.id + "' and b.id=a.course_id", function (err, studCount) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } if (studCount) {
                            ins.studentCount = studCount.length;
                            ins.studentList=studCount;
                            if (idx === insList.length - 1) {
                                insList.forEach((ins, idx1) => {
                                    db.query("SELECT * FROM instructor_course WHERE subcategory_id='" + catinfo + "' and user_id='" + ins.id + "'", function (err, courCount) {
                                        if (err) {
                                            console.log("Problem with MySQL productcatalog", err);
                                        }
                                        if (courCount) {
                                            ins.courseCount = courCount.length;
                                            if (idx1 === insList.length - 1) {
                                                // console.log("setcourse===",courseInfo);
                                                res.setHeader('Content-Type', 'application/json');
                                                res.status(200).send(insList);
                                            }
                                        }

                                    })
                                })
                            }

                        }
                    })
                })
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(insList);
            }
        }
    })
});


router.post('/setLectureViewInfo', function (req, res) {
    var authToken = req.body.authToken;
    var cat = req.body.cat;
    console.log("setLectureViewInfo========", authToken, cat);
    db.query("SELECT * FROM student_lecture_view_details WHERE student_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + cat.course_id + "' and section_id='" + cat.section_id + "' and lecture_id='" + cat.id + "'", function (err, learnersList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } if (learnersList) {
            if (learnersList.length > 0) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(learnersList);
            } else {
                db.query("INSERT INTO student_lecture_view_details (student_id,course_id,section_id,lecture_id,video_status) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + cat.course_id + "','" + cat.section_id + "','" + cat.id + "','start')", function (err, rows) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send(rows);
                    }
                })
            }
            // console.log("setcourse===",courseInfo);

        }
    })
});


router.post('/updateRatingInfo', function (req, res) {
    var authToken = req.body.authToken;
    var ratingdt = req.body.ratingdt;
    console.log("ratingdt========", ratingdt);
    db.query("UPDATE student_cart_details SET rating='" + ratingdt.rating + "',review='" + ratingdt.review + "' WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + ratingdt.courseid + "'", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({ 'status': 'Success' });
        }
    })
});


router.post('/setWishlist', function (req, res) {
    var authToken = req.body.authToken;
    var coursedt = req.body.coursedt;
    console.log("ratingdt========", coursedt);
    var q = "";
    db.query("SELECT * FROM course_wishlist WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + coursedt.id + "'", function (err, whishinfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } if (whishinfo) {
            if (whishinfo.length > 0) {
                q = "UPDATE course_wishlist SET status='" + coursedt.wishliStatus + "' WHERE user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "') and course_id='" + coursedt.id + "'"
            } else {
                q = "INSERT INTO course_wishlist (user_id,course_id,status) VALUES ((SELECT id FROM user_details WHERE authToken='" + authToken + "'),'" + coursedt.id + "','" + coursedt.wishliStatus + "')"
            }
            db.query(q, function (err, setSec) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    // console.log("setcourse===",courseInfo);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({ 'status': 'Success' });
                }
            })
        }
    })
});


router.post('/getRatingReviewPerCourse', function (req, res) {
    var courseId = req.body.courseId;
    console.log("courseId========", courseId);
    db.query("SELECT b.*,a.rating,a.review FROM student_cart_details a JOIN user_details b ON a.course_id='" + courseId + "' and a.user_id=b.id and (a.rating > 0 || a.review is not NULL)", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(setSec);
        }
    })
});


router.post('/getRatingReviewPerInstructor', function (req, res) {
    var authToken = req.body.authToken;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    console.log("pageInfo========", pageInfo);
    db.query("SELECT b.*,a.rating,a.review FROM student_cart_details a JOIN user_details b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.rating IS NOT NULL and a.user_id=b.id LIMIT "+fromLimit+","+toLimit+"", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            console.log("setSec===",setSec);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(setSec);
        }
    })
});



router.post('/getStudentListPerInstructor', function (req, res) {
    var authToken = req.body.authToken;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    console.log("authToken========", authToken);
    db.query("SELECT DISTINCT b.* FROM student_cart_details a JOIN user_details b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.user_id=b.id and a.cart_status='Closed' and b.role!=1 LIMIT "+fromLimit+","+toLimit+"", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            // console.log("setcourse===",courseInfo);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(setSec);
        }
    })
});

router.post('/checkCartInfo', function (req, res) {
    var authToken = req.body.authToken;
    var courseId = req.body.courseId;
    console.log("courseId========", courseId);
    db.query("SELECT * FROM student_cart_details WHERE course_id='" + courseId + "' and user_id=(SELECT id FROM user_details WHERE authToken='" + authToken + "')", function (err, setSec) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(setSec);
        }
    })
});


router.post('/getTutorDetails', function (req, res) {
    var tutorId = req.body.tutorId;
    console.log("tutorId========", tutorId);
    db.query("SELECT * FROM user_details WHERE id='" + tutorId + "'", function (err, userInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT a.*,b.category FROM instructor_course a JOIN course_category b ON a.user_id='" + tutorId + "' and a.category_id=b.id", function (err, courseInfo) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    db.query("SELECT id FROM student_cart_details WHERE instructor_id='" + tutorId + "'", function (err, studentCount) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            db.query("SELECT id FROM student_cart_details WHERE instructor_id='" + tutorId + "' and review IS NOT NULL", function (err, reviewCount) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    if(courseInfo.length > 0){
                                        var idx = 0;
                                        function courseCallBack() {
                                            async.eachOfSeries(courseInfo,()=> {
                                                coursedt = courseInfo[idx];
                                                db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                                                    if (err) {
                                                        console.log("Problem with MySQL productcatalog", err);
                                                    } else {
                                                        console.log("ratingDt----",ratingDt);
                                                        coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                                        coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                                        idx++;
                                                        if(idx === courseInfo.length){
                                                            res.setHeader('Content-Type', 'application/json');
                                                            res.status(200).send({ 'userInfo': userInfo, 'courseInfo': courseInfo, 'studentCount': studentCount, 'reviewCount': reviewCount });   
                                                        }else{
                                                            courseCallBack();
                                                        }
                                                        
                                                    }
                                                })
                                            })
                                        }
                                        courseCallBack();
                                    }else{
                                        res.setHeader('Content-Type', 'application/json');
                                        res.status(200).send({ 'userInfo': userInfo, 'courseInfo': courseInfo, 'studentCount': studentCount, 'reviewCount': reviewCount });    
                                    }
                                    
                                }
                            })
                        }
                    })
                }
            })
        }
    })
});




router.post('/getQuestionareDetails', function (req, res) {
    var courseInfo = req.body.courseInfo;
    console.log("courseInfo========", courseInfo);
    db.query("SELECT a.*,b.user_name,b.selfie_image FROM course_lecture_questions a JOIN user_details b ON a.course_id='" + courseInfo.id + "' and a.student_id=b.id", function (err, quesinfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(quesinfo.length > 0){
                quesinfo.forEach((ques,idx)=>{
                    db.query("SELECT * FROM course_lecture_answers WHERE course_id='"+ques.course_id+"' and section_id='"+ques.section_id+"' and lecture_id='"+ques.lecture_id+"' and question_id='"+ques.id+"'", function (err, ansInfo) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            ques['ansCount']=ansInfo.length;
                            if(idx === quesinfo.length - 1 ){
                                res.setHeader('Content-Type', 'application/json');
                                res.status(200).send(quesinfo);
                            }
                            
                        }
                    })
                })
                
            }else{
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send(quesinfo);
            }
        }
    })
});



router.post('/setQuestionInfo', function (req, res) {
    var authToken = req.body.authToken;
    var currentLecture=req.body.currentLecture;
    var questionInfo=req.body.questionInfo;
    console.log("courseInfo========", currentLecture);
    db.query("INSERT INTO course_lecture_questions (course_id,section_id,lecture_id,student_id,instructor_id,ques_title,ques_details,ques_status) VALUES ('"+currentLecture.course_id+"','"+currentLecture.section_id+"','"+currentLecture.id+"',(SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+currentLecture.user_id+"','"+questionInfo.title+"','"+questionInfo.details+"','Unread')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/getQuestionareDetailsPerInstructor', function (req, res) {
    var authToken = req.body.authToken;
    console.log("authToken========", authToken);
    db.query("SELECT a.*,b.user_name,b.selfie_image,c.course_title,d.section_title,e.lecture_title FROM course_lecture_questions a JOIN user_details b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='" +authToken+ "') and a.student_id=b.id JOIN instructor_course c ON a.course_id=c.id JOIN instructor_course_sections d ON d.is_deleted=0 and a.section_id=d.id JOIN instructor_course_lectures e ON a.lecture_id=e.id and e.is_deleted=0", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(rows);
        }
    })
});


router.post('/showExistingReply', function (req, res) {
    var ques = req.body.ques;
    db.query("SELECT a.*,b.user_name as answered_user,b.selfie_image as answered_profile FROM course_lecture_answers a JOIN user_details b ON a.course_id='"+ques.course_id+"' and a.section_id='"+ques.section_id+"' and a.lecture_id='"+ques.lecture_id+"' and a.question_id='"+ques.id+"' and a.answered_by=b.id", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(rows);
        }
    })
});


router.post('/setAnswerInfo', function (req, res) {
    var authToken = req.body.authToken;
    var currentques=req.body.currentques;
    var ansinfo=req.body.ansinfo;
    console.log("ansinfo========", ansinfo);
    db.query("INSERT INTO course_lecture_answers (course_id,section_id,lecture_id,student_id,instructor_id,question_id,answered_by,answer,reply_status) VALUES ('"+currentques.course_id+"','"+currentques.section_id+"','"+currentques.lecture_id+"','"+currentques.student_id+"','"+currentques.instructor_id+"','"+currentques.id+"',(SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+ansinfo.answer+"','New')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/setNotesInfo', function (req, res) {
    var authToken = req.body.authToken;
    var currentLecture=req.body.currentLecture;
    var notesData=req.body.notesData;
    var videoTime=req.body.videoTime;
    console.log("notesData========", notesData);
    db.query("INSERT INTO course_lecture_notes (course_id,section_id,lecture_id,student_id,instructor_id,notes,time) VALUES ('"+currentLecture.course_id+"','"+currentLecture.section_id+"','"+currentLecture.id+"',(SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+currentLecture.user_id+"','"+notesData.notes+"','"+videoTime+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/getNotesList', function (req, res) {
    var authToken = req.body.authToken;
    var currentLecture=req.body.currentLecture;
    var notesData=req.body.notesData;
    console.log("notesData========", notesData);
    db.query("SELECT a.*,b.section_title,c.lecture_title FROM course_lecture_notes a JOIN instructor_course_sections b ON a.course_id='"+currentLecture.course_id+"' and a.section_id='"+currentLecture.section_id+"' and a.lecture_id='"+currentLecture.id+"' and a.student_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.section_id=b.id and b.is_deleted=0 JOIN instructor_course_lectures c ON a.lecture_id=c.id and c.is_deleted=0", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            console.log("rows---",rows);
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(rows);
        }
    })
});


router.post('/updateNotesInfo', function (req, res) {
    var notesData=req.body.notesData;
    var editVal=req.body.editVal;
    console.log("notesData========", notesData);
    db.query("UPDATE course_lecture_notes SET notes='"+editVal.notesEdit+"' WHERE id='"+notesData.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});



router.post('/deleteNotesInfo', function (req, res) {
    var notesData=req.body.notesData;
    console.log("notesData========", notesData);
    db.query("DELETE FROM course_lecture_notes WHERE id='"+notesData.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/getInstructorListForMsg', function (req, res) {
    var authToken=req.body.authToken;
    db.query("SELECT id,user_name FROM user_details WHERE role !=1 and id IN (SELECT DISTINCT user_id FROM instructor_course) and id NOT IN (SELECT id FROM user_details WHERE authToken='"+authToken+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(rows); 
        }
    })
});


router.post('/getUserListForMsg', function (req, res) {
    var authToken=req.body.authToken;
    db.query("SELECT id,user_name FROM user_details WHERE role !=1 and id NOT IN (SELECT id FROM user_details WHERE authToken='"+authToken+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send(rows); 
        }
    })
});


router.post('/setMessageInfo', function (req, res) {
    var messageData=req.body.messageData;
    var authToken=req.body.authToken;
    console.log("messageData========", messageData);
    db.query("SELECT * FROM chaters_list WHERE ((sender_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and receiver_id='"+messageData.instructor_id+"') OR (sender_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and receiver_id='"+messageData.instructor_id+"'))", function (err, chaterList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(chaterList.length>0){
                db.query("INSERT INTO message_details (sender_id,receiver_id,message,status) VALUE ((SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+messageData.instructor_id+"','"+messageData.message+"','S')", function (err, rows) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({'status':'Success'});
                    }
                })
            }else{
                db.query("INSERT INTO chaters_list (sender_id,sender_name,sender_profile,receiver_id,receiver_name,receiver_profile) VALUE ((SELECT id FROM user_details WHERE authToken='"+authToken+"'),(SELECT user_name FROM user_details WHERE authToken='"+authToken+"'),(SELECT selfie_image FROM user_details WHERE authToken='"+authToken+"'),'"+messageData.instructor_id+"','"+messageData.instructor+"',(SELECT selfie_image FROM user_details WHERE id='"+messageData.instructor_id+"'))", function (err, rows) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        db.query("INSERT INTO message_details (sender_id,receiver_id,message,status) VALUE ((SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+messageData.instructor_id+"','"+messageData.message+"','S')", function (err, rows) {
                            if (err) {
                                console.log("Problem with MySQL productcatalog", err);
                            } else {
                                res.setHeader('Content-Type', 'application/json');
                                res.status(200).send({'status':'Success'});
                            }
                        })
                    }
                })
            }
         
        }
    })
    
});


router.post('/setConversationInfo', function (req, res) {
    var message=req.body.message;
    var currentChat=req.body.currentChat;
    console.log("message========", message);
    db.query("INSERT INTO message_details (sender_id,receiver_id,message,status) VALUE ('"+currentChat.senderid+"','"+currentChat.receiverid+"','"+message+"','S')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/getMessageList', function (req, res) {
    var chater=req.body.chater;
    db.query("SELECT * FROM message_details WHERE sender_id in ('"+chater.senderid+"','"+chater.receiverid+"') and receiver_id in ('"+chater.senderid+"','"+chater.receiverid+"')", function (err, data) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(data){  
                db.query("SELECT selfie_image as fromprofile FROM user_details  where id='"+chater.senderid+"'",
                  function(err,datas1){
                   if(datas1){ 
                      db.query("SELECT selfie_image as toprofile FROM user_details  where id='"+chater.receiverid+"'",
                      function(err,datas2){
                      if(datas2){ 
                           res.send({"chatdatas":data,"frompprofile":datas1,"topprofile":datas2});
                         }
                      });
                    }
                }) 
             }
        }
    })
});


router.post('/getchaterlist', function (req, res) {
    var authToken=req.body.authToken;
    console.log("messageData========", authToken);
    db.query("SELECT a.sender_id as senderid,a.sender_profile as senderprofile,a.receiver_id as receiverid,a.receiver_profile as receiverprofile,a.receiver_name as receivername,a.sender_name as sendername FROM chaters_list a WHERE  a.sender_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') OR  a.receiver_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') ORDER BY a.id DESC", function (err, chaterList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(chaterList.length > 0){
                // console.log("chaterList----",chaterList);
                chaterList.forEach(function(msglist,idx){
                    db.query("SELECT a.message,a.sender_id as senderid,a.receiver_id as receiverid FROM message_details a WHERE a.sender_id in ('"+msglist.senderid+"','"+msglist.receiverid+"') and a.receiver_id in ('"+msglist.senderid+"','"+msglist.receiverid+"') order by a.id DESC LIMIT 1",
                      function(err,msgdt){
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } 
                        if(msgdt){
                             console.log("msgdt======",msglist.senderid,msglist.receiverid);
                          msglist.chatmsg=(msgdt.length>0 ? msgdt[0].message : '');   
                          db.query("SELECT * FROM message_details a WHERE receiver_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and sender_id in ('"+msglist.senderid+"','"+msglist.receiverid+"') and a.status='S'", //notify
                          function(err,msgcnt){
                            if(msgcnt){
                              msglist.newmsg=(msgcnt.length);   
                            if(idx === chaterList.length-1){
                            //  console.log("getchat list-data2---",chaterList);
                            res.send(chaterList);
                          }
                        }
                      })
                    }
                  })
                 })
            }
        }
    })
});



router.post('/getLoggedInUser', function (req, res) {
    var authToken=req.body.authToken;
    console.log("messageData========", authToken);
    db.query("SELECT * FROM user_details WHERE authToken ='"+authToken+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'data':rows});
        }
    })
});



router.post('/updateMessageNotification', function (req, res) {
    var senderid=req.body.senderid;
    var receiverid=req.body.receiverid;
    console.log("messageData========", receiverid);
    db.query("UPDATE message_details SET status='R' WHERE receiver_id='"+senderid+"' and sender_id='"+receiverid+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'data':rows});
        }
    })
});


router.post('/getMessageCount', function (req, res) {
    var authToken=req.body.authToken;
    console.log("messageData========", authToken);
    db.query("SELECT * FROM message_details WHERE receiver_id =(SELECT id FROM user_details WHERE authToken='"+authToken+"') and status='S'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'data':rows.length});
        }
    })
});


router.post('/setAnnouncementInfo', function (req, res) {
    var authToken=req.body.authToken;
    var announcementDt=req.body.announcementDt;
    console.log("messageData========", authToken);
    db.query("INSERT INTO instructor_announcement (instructor_id,title,description) VALUES ((SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+announcementDt.title+"','"+announcementDt.description+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/getAnnouncementList', function (req, res) {
    var authToken=req.body.authToken;
    console.log("messageData========", authToken);
    db.query("SELECT * FROM instructor_announcement WHERE instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and is_deleted=0", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'data':rows});
        }
    })
});


router.post('/getAnnouncementListWithComment', function (req, res) {
    var authToken=req.body.authToken;
    console.log("messageData========", authToken);
    db.query("SELECT * FROM instructor_announcement WHERE instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and is_deleted=0", function (err, announcementList) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            if(announcementList.length > 0){
                announcementList.forEach((annDt,idx)=>{
                    db.query("SELECT * FROM instructor_announcement_comments WHERE instructor_id='"+annDt.instructor_id+"' and announcement_id='"+annDt.id+"' and is_deleted=0", function (err, commentdt) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            annDt['commentInfo']=commentdt;
                            if(idx === announcementList.length-1){
                                res.setHeader('Content-Type', 'application/json');
                                res.status(200).send({'data':announcementList});
                            }
                        }
                    })
                })
            }else{
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({'data':announcementList});
            }
            
        }
    })
});

router.post('/deleteAnnouncement', function (req, res) {
    var delData=req.body.delData;
    console.log("delData========", delData);
    db.query("UPDATE instructor_announcement SET is_deleted=1 WHERE id='"+delData.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/updateAnnouncementInfo', function (req, res) {
    var authToken=req.body.authToken;
    var announcementDt=req.body.announcementDt;
    db.query("UPDATE instructor_announcement SET title='"+announcementDt.title+"', description='"+announcementDt.description+"' WHERE id='"+announcementDt.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/setCommentInfo', function (req, res) {
    var userInitial=req.body.userInitial;
    var announceDt=req.body.announceDt;
    var authToken=req.body.authToken;
    var comment=req.body.comment;
    console.log("messageData========", authToken);
    db.query("INSERT INTO instructor_announcement_comments (user_initial,instructor_id,announcement_id,user_id,comment) VALUES ('"+userInitial+"','"+announceDt.instructor_id+"','"+announceDt.id+"',(SELECT id FROM user_details WHERE authToken='"+authToken+"'),'"+comment+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/deleteComment', function (req, res) {
    var delData=req.body.delData;
    console.log("delData========", delData);
    db.query("UPDATE instructor_announcement_comments SET is_deleted=1 WHERE id='"+delData.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/updateCommentInfo', function (req, res) {
    var commtDt=req.body.commtDt;
    var comment=req.body.comment;
    console.log("commtDt========", commtDt);
    db.query("UPDATE instructor_announcement_comments SET comment='"+comment+"' WHERE id='"+commtDt.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});



router.post('/setCategoryInfo', function (req, res) {
    var categoryDt=req.body.categoryDt;
    db.query("INSERT INTO course_category (category,active) VALUES ('"+categoryDt.category+"','"+categoryDt.active+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});

router.post('/updateCategoryInfo', function (req, res) {
    var categoryDt=req.body.categoryDt;
    db.query("UPDATE course_category SET category='"+categoryDt.category+"',active='"+categoryDt.active+"' WHERE id='"+categoryDt.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});

router.post('/setSubCategoryInfo', function (req, res) {
    var subcategoryDt=req.body.subcategoryDt;
    db.query("INSERT INTO course_subcategory (category_id,subcategory,active) VALUES ('"+subcategoryDt.category+"','"+subcategoryDt.subcategory+"','"+subcategoryDt.active+"')", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});

router.post('/updateSubCategoryInfo', function (req, res) {
    var subcategoryDt=req.body.subcategoryDt;
    db.query("UPDATE course_subcategory SET subcategory='"+subcategoryDt.subcategory+"',active='"+subcategoryDt.active+"' WHERE id='"+subcategoryDt.id+"'", function (err, rows) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({'status':'Success'});
        }
    })
});


router.post('/getUserDashboardCount', function (req, res) {
    var authToken=req.body.authToken;
    var dateObj=req.body.dateObj;
    var fromdate = moment(new Date(dateObj.fromDate)).format("YYYY-MM-DD");
    var todate = moment(new Date(dateObj.toDate)).format("YYYY-MM-DD");  
    db.query("SELECT SUM(a.course_price) as totalRevenue FROM instructor_course a JOIN student_cart_details b ON a.user_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.id=b.course_id and b.cart_status='Closed' GROUP BY a.user_id", function (err, revenueData) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT SUM(a.course_price) as monthRevenue FROM instructor_course a JOIN student_cart_details b ON a.user_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.id=b.course_id and b.cart_status='Closed' and '" + fromdate + "' <= b.cur_date  AND b.cur_date <= '" + todate + "' GROUP BY a.user_id", function (err, monthrevenueData) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    db.query("SELECT COUNT(*) as totalEnroll FROM student_cart_details WHERE instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and cart_status='Closed'", function (err, enrollData) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            db.query("SELECT COUNT(*) as monthEnroll FROM student_cart_details WHERE instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and cart_status='Closed' and '" + fromdate + "' <= cur_date  AND cur_date <= '" + todate + "'", function (err, monthenrollData) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and rating IS NOT NULL group by instructor_id", function (err, ratingData) {
                                        if (err) {
                                            console.log("Problem with MySQL productcatalog", err);
                                        } else {
                                            db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and '" + fromdate + "' <= cur_date  AND cur_date <= '" + todate + "' and rating IS NOT NULL group by instructor_id", function (err, monthratingData) {
                                                if (err) {
                                                    console.log("Problem with MySQL productcatalog", err);
                                                } else {
                                                    res.setHeader('Content-Type', 'application/json');
                                                    res.status(200).send({'revenueData':revenueData,'monthrevenueData':monthrevenueData,'enrollData':enrollData,'monthenrollData':monthenrollData,'ratingData':ratingData,'monthratingData':monthratingData});
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    })
});


router.post('/getUserRevenueDetails', function (req, res) {
    var authToken=req.body.authToken;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT a.*,SUM(a.course_price) as courseRevenue FROM instructor_course a JOIN student_cart_details b ON a.user_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.id=b.course_id and b.cart_status='Closed' GROUP BY a.id LIMIT "+fromLimit+","+toLimit+"", function (err, revenueInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT a.id FROM instructor_course a JOIN student_cart_details b ON a.user_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.id=b.course_id and b.cart_status='Closed' GROUP BY a.id", function (err, revenueCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'revenueInfo':revenueInfo,'revenueCount':revenueCount.length});
                }
            })
        }
    })
});


router.post('/getStudentsViewForRevenue', function (req, res) {
    var revenuedt=req.body.revenuedt;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.viewPage * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT b.* FROM student_cart_details a JOIN user_details b ON a.course_id='"+revenuedt.id+"' and a.user_id=b.id and a.cart_status='Closed' LIMIT "+fromLimit+","+toLimit+"", function (err, revenueViewInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT b.id FROM student_cart_details a JOIN user_details b ON a.course_id='"+revenuedt.id+"' and a.user_id=b.id and a.cart_status='Closed' ", function (err, revenueViewCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    console.log("revenueViewCount====",revenueViewCount.length);
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'revenueViewInfo':revenueViewInfo,'revenueViewCount':revenueViewCount.length});
                }
            })
        }
    })
});


router.post('/getInstructorViewForAdmin', function (req, res) {
    var coursedt=req.body.coursedt;
    db.query("SELECT b.* FROM instructor_course a JOIN user_details b ON a.id='"+coursedt.id+"' and a.user_id=b.id", function (err, insInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            insInfo.forEach((insdt,idx)=>{  
                db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE instructor_id='"+insdt.id+"' and rating IS NOT NULL group by instructor_id", function (err, ratingData) {
                    if (err) {
                        console.log("Problem with MySQL productcatalog", err);
                    } else {
                        insdt['averageRating']=(ratingData.length > 0 ? ratingData[0].averageRating : 0);
                        insdt['ratingCount']=(ratingData.length > 0 ? ratingData[0].ratingCount : 0);
                        if(idx === insInfo.length-1){
                            console.log("insInfo===",insInfo);
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send({'insInfo':insInfo});
                        }
                    }
                })
            })
        }
    })
});

router.post('/getUserEnrollmentDetails', function (req, res) {
    var authToken=req.body.authToken;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT DISTINCT b.* FROM student_cart_details a JOIN user_details b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.user_id=b.id and a.cart_status='Closed' LIMIT "+fromLimit+","+toLimit+"", function (err, enrollInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT DISTINCT b.id FROM student_cart_details a JOIN user_details b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.user_id=b.id and a.cart_status='Closed'", function (err, enrollCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'enrollInfo':enrollInfo,'enrollCount':enrollCount.length});
                }
            })
        }
    })
});


router.post('/getCoursesViewForEnroll', function (req, res) {
    var enrolldt=req.body.enrolldt;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.viewPage * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT b.* FROM student_cart_details a JOIN instructor_course b ON a.user_id='"+enrolldt.id+"' and a.course_id=b.id and a.cart_status='Closed' LIMIT "+fromLimit+","+toLimit+"", function (err, enrollViewInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT b.id FROM student_cart_details a JOIN instructor_course b ON a.user_id='"+enrolldt.id+"' and a.course_id=b.id and a.cart_status='Closed'", function (err, enrollViewCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'enrollViewInfo':enrollViewInfo,'enrollViewCount':enrollViewCount.length});
                }
            })
        }
    })
});


router.post('/getUserRatingDetails', function (req, res) {
    var authToken=req.body.authToken;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT avg(a.rating) averageRating,count(a.id) ratingCount,b.* FROM student_cart_details a JOIN instructor_course b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.rating IS NOT NULL and a.course_id=b.id group by a.course_id LIMIT "+fromLimit+","+toLimit+"", function (err, ratingInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT avg(a.rating) averageRating,count(a.id) ratingCount,b.id FROM student_cart_details a JOIN instructor_course b ON a.instructor_id=(SELECT id FROM user_details WHERE authToken='"+authToken+"') and a.rating IS NOT NULL and a.course_id=b.id group by a.course_id", function (err, ratingCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'ratingInfo':ratingInfo,'ratingCount':ratingCount.length});
                }
            })
        }
    })
});


router.post('/getCoursesViewForRating', function (req, res) {
    var ratdt=req.body.ratdt;
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.viewPage * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT b.*,a.rating,a.review FROM student_cart_details a JOIN user_details b ON a.course_id='"+ratdt.id+"' and a.user_id=b.id and a.rating IS NOT NULL and a.cart_status='Closed' LIMIT "+fromLimit+","+toLimit+"", function (err, ratingViewInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT b.id,a.rating,a.review FROM student_cart_details a JOIN user_details b ON a.course_id='"+ratdt.id+"' and a.user_id=b.id and a.rating IS NOT NULL and a.cart_status='Closed'", function (err, ratingViewCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'ratingViewInfo':ratingViewInfo,'ratingViewCount':ratingViewCount.length});
                }
            })
        }
    })
});

router.get('/getAdminDashboardCount', function (req, res) {
    db.query("SELECT COUNT(id) as totalCourse FROM instructor_course", function (err, courseCount) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT COUNT(DISTINCT user_id) as totalInstructor FROM instructor_course", function (err, insCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    db.query("SELECT COUNT(DISTINCT user_id) as totalStudent FROM student_cart_details WHERE cart_status='Closed'", function (err, studCount) {
                        if (err) {
                            console.log("Problem with MySQL productcatalog", err);
                        } else {
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200).send({'courseCount':courseCount,'insCount':insCount,'studCount':studCount});
                        }
                    })
                }
            })
        }
    })
});


router.post('/getCousesDetails', function (req, res) {
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT a.*,b.category,c.subcategory,d.name as level FROM instructor_course a JOIN course_category b ON a.category_id=b.id LEFT JOIN course_subcategory c ON a.subcategory_id=c.id LEFT JOIN course_level d ON a.course_level=d.id LIMIT "+fromLimit+","+toLimit+"", function (err, courseInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT a.id FROM instructor_course a JOIN course_category b ON a.category_id=b.id LEFT JOIN course_subcategory c ON a.subcategory_id=c.id LEFT JOIN course_level d ON a.course_level=d.id", function (err, courseCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    if(courseInfo.length > 0){
                        courseInfo.forEach((coursedt,idx)=>{
                            db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE course_id='"+coursedt.id+"' and instructor_id='"+coursedt.user_id+"' and rating IS NOT NULL group by course_id,instructor_id", function (err, ratingDt) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    console.log("ratingDt----",ratingDt);
                                    coursedt.averageRating= (ratingDt.length > 0 ? ratingDt[0].averageRating : 0);
                                    coursedt.ratingCount=(ratingDt.length > 0 ? ratingDt[0].ratingCount : 0);
                                    if(idx === courseInfo.length-1){
                                        console.log("courseInfo======")
                                        res.setHeader('Content-Type', 'application/json');
                            	        res.status(200).send({'data':courseInfo,'courseCount':courseCount.length});
                                    }
                                }
                            })
                        })
                    }else{
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({'data':courseInfo,'courseCount':courseCount.length});
                    }
                }
            })
        }
    })
});


router.post('/getOverallInstructorList', function (req, res) {
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT DISTINCT b.* FROM instructor_course a JOIN user_details b ON a.course_status='Public' and a.user_id=b.id and b.role!=1 LIMIT "+fromLimit+","+toLimit+"", function (err, insInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT DISTINCT b.id FROM instructor_course a JOIN user_details b ON a.course_status='Public' and a.user_id=b.id and b.role!=1", function (err, insCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    if(insInfo.length > 0){
                        insInfo.forEach((insdt,idx)=>{  
                            db.query("SELECT avg(rating) averageRating,count(*) ratingCount FROM student_cart_details WHERE instructor_id='"+insdt.id+"' and rating IS NOT NULL group by instructor_id", function (err, ratingData) {
                                if (err) {
                                    console.log("Problem with MySQL productcatalog", err);
                                } else {
                                    insdt['averageRating']=(ratingData.length > 0 ? ratingData[0].averageRating : 0);
                                    insdt['ratingCount']=(ratingData.length > 0 ? ratingData[0].ratingCount : 0);
                                    if(idx === insInfo.length-1){
                                        console.log("insInfo===",insInfo);
                                        res.setHeader('Content-Type', 'application/json');
                                        res.status(200).send({'insInfo':insInfo,'insCount':insCount.length});
                                    }
                                }
                            })
                        })
                    }else{
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200).send({'insInfo':insInfo,'insCount':insCount.length});
                    }
                }
            })
        }
    })
});


router.post('/getOverallStudentList', function (req, res) {
    var pageInfo=req.body.pageInfo;
    var fromLimit= (pageInfo.page * pageInfo.tableSize);
    var toLimit = pageInfo.tableSize;
    db.query("SELECT DISTINCT b.* FROM student_cart_details a JOIN user_details b ON a.cart_status='Closed' and a.user_id=b.id and b.role!=1 LIMIT "+fromLimit+","+toLimit+"", function (err, studInfo) {
        if (err) {
            console.log("Problem with MySQL productcatalog", err);
        } else {
            db.query("SELECT DISTINCT b.id FROM student_cart_details a JOIN user_details b ON a.cart_status='Closed' and a.user_id=b.id and b.role!=1", function (err, studCount) {
                if (err) {
                    console.log("Problem with MySQL productcatalog", err);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({'studInfo':studInfo,'studCount':studCount.length});
                }
            })
        }
    })
});

module.exports = router;