var mongoose = require('mongoose');
var moment = require('moment');

mongoose.set('strictQuery', false);

var initConnection = function (connString) {
  return new Promise(function (resolve, reject) {
    mongoose
      .connect(connString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => {
        console.log(`[${moment(Date.now()).format('DD/MM/YYYY HH:mm:SS')}] Successfully connected to MongoDB.`);
        resolve();
      })
      .catch((err) => {
        console.log("--> There was an error connecting to MongoDB:", err.message);
        reject(err);
      });
  });
};

module.exports = initConnection;
