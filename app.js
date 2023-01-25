const express = require("express");
const app = express();
app.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

const sqlite = require("sqlite");
const { open } = sqlite;
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jsonWebToken = require("jsonwebtoken");

let db;
let initializeDBServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, (request, response) => {
      console.log("Server Running at http://localhost:3000/ Port");
    });
  } catch (error) {
    consolr.log(error);
    process.exit(1);
  }
};
initializeDBServer();
let validateToken = (request, response, next) => {
  let token = request.headers["authorization"];
  if (token !== undefined) {
    token = token.split(" ")[1];
    jsonWebToken.verify(token, "aeiou", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payLoad.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};
/////////////  Register APIS /////////////////
app.post("/register/", async (request, response) => {
  try {
    let { username, password, name, gender } = request.body;
    console.log(username, password, name, gender);
    let user = `SELECT * FROM user WHERE username = '${username}';`;
    user = await db.get(user);
    console.log(user);
    if (user === undefined) {
      if (password.length >= 6) {
        let hashPashword = await bcrypt.hash(password, 10);
        console.log(hashPashword);
        let insertQuery = `INSERT INTO user (username, password, name,gender)
                        values('${username}','${hashPashword}','${name}','${gender}')`;
        await db.run(insertQuery);
        response.status(200);
        response.send("User created successfully");
      } else {
        response.status(400);
        response.send("Password is too short");
      }
    } else {
      response.status(400);
      response.send("User already exists");
    }
  } catch (error) {
    response.status(400);
    response.send("Please Check the user details");
  }
});
/////////////  LOGIN APIS /////////////////
app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let user = `SELECT * FROM user WHERE username = '${username}';`;
  user = await db.get(user);
  if (user !== undefined) {
    let isValidPass = await bcrypt.compare(password, user.password);
    if (isValidPass === true) {
      payLoad = { username: username };
      let jwtToken = jsonWebToken.sign(payLoad, "aeiou");
      response.status(200);
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
/////////// GET APIS /////////////////
app.get("/user/tweets/feed/", validateToken, async (request, response) => {
  console.log("Attentyication Successful");
  let username = request.username;
  console.log(username);
  let userID = `SELECT user_id FROM user WHERE username = '${username}';`;
  userID = await db.get(userID);
  userID = userID.user_id;
  let getQuery = `SELECT user.username as username, tweet.tweet as tweet, tweet.date_time as dateTime 
FROM tweet inner join user on  user.user_id = tweet.user_id
WHERE user.user_id in (select following_user_id from follower where follower_user_id = ${userID})
order by dateTime DESC limit 4;`;
  let result = await db.all(getQuery);
  response.status(200);
  response.send(result);
});

///////////// GET APIS /////////////
app.get("/user/following/", validateToken, async (request, response) => {
  let username = request.username;
  let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
  userId = await db.get(userId);
  console.log(userId.user_id);
  let followingNames = `select name from user where user_id in (select following_user_id  from follower where follower_user_id = ${userId.user_id});`;
  followingNames = await db.all(followingNames);
  console.log(followingNames);
  response.status(200);
  response.send(followingNames);
});

///////////// GET APIS /////////////

app.get("/user/followers/", validateToken, async (request, response) => {
  let username = request.username;
  let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
  userId = await db.get(userId);
  console.log(userId.user_id);
  let followingNames = `select name from user where user_id in (select follower_user_id  from follower where following_user_id = ${userId.user_id});`;
  followingNames = await db.all(followingNames);
  console.log(followingNames);
  response.status(200);
  response.send(followingNames);
});

////////////// GET API BY tweetId /////////////
app.get("/tweets/:tweetId/", validateToken, async (request, response) => {
  let { tweetId } = request.params;
  console.log(tweetId);
  let username = request.username;
  let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
  userId = await db.get(userId);
  console.log(userId.user_id);
  let fallowing_users = `SELECT following_user_id FROM follower WHERE follower_user_id = ${userId.user_id}`;
  //   fallowing_users = await db.all(fallowing_users);
  //   console.log(fallowing_users);
  let tewets = `SELECT tweet_id FROM tweet WHERE user_id in (${fallowing_users})`;

  let query = `SELECT * FROM tweet where tweet_id in (${tewets});`;
  tweets = await db.all(query);

  if (tweets.some((eachObj) => eachObj.tweet_id === parseInt(tweetId))) {
    let tweetResult = `select tweet.tweet as tweet, count(distinct like.like_id) as likes, count(distinct reply.reply_id) as replies, tweet.date_time as dateTime
from tweet inner join reply on tweet.tweet_id = reply.tweet_id inner join like on tweet.tweet_id = like.tweet_id where like.tweet_id = ${tweetId}; and reply.tweet_id = ${tweetId};`;
    tweetResult = await db.get(tweetResult);
    response.send(tweetResult);
    response.status(200);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
////////////// GET API BY tweetId /////////////
app.get("/tweets/:tweetId/likes/", validateToken, async (request, response) => {
  let { tweetId } = request.params;
  let username = request.username;
  console.log(tweetId, username);
  let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
  userId = await db.get(userId);
  console.log(userId);
  let fallowing_tweet_ids = `select tweet_id from tweet where user_id in (select following_user_id from follower where follower_user_id = ${userId.user_id});`;

  fallowing_tweet_ids = await db.all(fallowing_tweet_ids);
  fallowing_tweet_ids = fallowing_tweet_ids.map((each) => each.tweet_id);
  console.log(fallowing_tweet_ids, tweetId);

  if (fallowing_tweet_ids.includes(parseInt(tweetId))) {
    let fallowing_names = `select username from user where user_id in (select user_id from like where tweet_id = ${tweetId});`;

    fallowing_names = await db.all(fallowing_names);
    console.log(fallowing_names);
    fallowing_names = fallowing_names.map((each) => each.username);
    response.send({ likes: fallowing_names });
    response.status(200);
  } else {
    response.send("Invalid Request");
    response.status(401);
  }
});
////////////// GET API BY tweetId /////////////
app.get(
  "/tweets/:tweetId/replies/",
  validateToken,
  async (request, response) => {
    let { tweetId } = request.params;
    let username = request.username;
    console.log(tweetId, username);
    let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
    userId = await db.get(userId);
    console.log(userId);
    let fallowing_tweet_ids = `select tweet_id from tweet where user_id in (select follower_user_id from follower where following_user_id = ${userId.user_id});`;

    fallowing_tweet_ids = await db.all(fallowing_tweet_ids);
    fallowing_tweet_ids = fallowing_tweet_ids.map((each) => each.tweet_id);
    console.log(fallowing_tweet_ids, tweetId);

    if (fallowing_tweet_ids.includes(parseInt(tweetId))) {
      let fallowing_names = `select user.name, reply.reply from user inner join reply on user.user_id = reply.user_id where reply.tweet_id = ${tweetId};`;
      fallowing_names = await db.all(fallowing_names);

      response.send({ replies: fallowing_names });
      response.status(200);
    } else {
      response.send("Invalid Request");
      response.status(400);
    }
  }
);
////////////// GET API BY tweetId /////////////
app.get("/user/tweets/", validateToken, async (request, response) => {
  let username = request.username;
  console.log(username);
  let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
  userId = await db.get(userId);
  console.log(userId);
  let objList = `select tweet.tweet,  count(distinct like.like_id) as likes, count(distinct reply.reply_id) as replies, tweet.date_time as dateTime from (tweet inner join reply on tweet.tweet_id = reply.tweet_id) inner join like on like.tweet_id = tweet.tweet_id where tweet.user_id = ${userId.user_id} group by tweet.tweet_id;`;
  objList = await db.all(objList);
  console.log(objList);
  response.send(objList);
  response.status(200);
});

////////////// POST API BY tweetId /////////////

app.post("/user/tweets/", validateToken, async (request, response) => {
  let username = request.username;
  let { tweet } = request.body;
  console.log(tweet);
  let userId = `SELECT user_id FROM user WHERE username = '${username}';`;
  userId = await db.get(userId);
  let date = new Date();
  let newDate =
    date.getFullYear() +
    "-" +
    (date.getMonth() + 1) +
    "-" +
    date.getDate() +
    " " +
    date.getHours() +
    ":" +
    date.getMinutes() +
    ":" +
    date.getSeconds();
  let insertQuery = `INSERT INTO tweet ( tweet, user_id, date_time)
                                 values( '${tweet}',${userId.user_id},'${newDate}')`;
  await db.run(insertQuery);
  response.send("Created a Tweet");
  response.status(200);
});

////////////// DELETE API BY tweetId /////////////

app.delete("/tweets/:tweetId/", validateToken, async (request, response) => {
  let username = request.username;
  let { tweetId } = request.params;
  let isuserPresent = `select user_id from user where username = '${username}';`;
  let userId = await db.get(isuserPresent);
  let tweetsList = `select tweet_id from tweet where user_id = ${userId.user_id};`;
  tweetsList = await db.all(tweetsList);
  tweetsList = tweetsList.map((each) => each.tweet_id);

  if (tweetsList.includes(parseInt(tweetId))) {
    let deleteQuery = `DELETE from tweet where tweet_id = ${tweetId};`;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
    response.status(200);
  } else {
    response.send("Invalid Request");
    response.status(401);
  }
});
module.exports = app;
