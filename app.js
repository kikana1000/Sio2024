var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const moment = require('moment');
require("dotenv").config();

var mongoConnect = require('./database/__initializer');

var indexRouter = require("./routes/index");
var dashRouter = require("./routes/dash");
var saftRouter = require("./routes/saft");
var productsRouter = require("./routes/products");
var customersRouter = require("./routes/customer");
var suppliersRouter = require("./routes/supplier");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/dashboard", dashRouter);
app.use("/upload", saftRouter);
app.use("/products", productsRouter);
app.use("/customers", customersRouter);
app.use("/suppliers", suppliersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) { 
  next(createError(404, {reason: ``}));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// setting up refresh token
const Scheduler = require('node-schedule');
const TokenUtils = require('./utils/TokenUtils.js');

const uri = `mongodb+srv://${process.env.mongo_user}:${process.env.mongo_pass}@${process.env.mongo_cluster}/${process.env.mongo_collection}?retryWrites=true&w=majority`;

mongoConnect(uri).then(() => {
  TokenUtils.collect()

  Scheduler.scheduleJob('* /3 * * *', function () {
    console.log(`\n\n[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Updating access token.`);
    TokenUtils.update();
  });
})

module.exports = app;
