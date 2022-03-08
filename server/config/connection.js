const mongoose = require('mongoose');

mongoose.connect(
  process.env.MONGODB_URI || 'rate-my-portfolio-1.herokuapp.com',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  }
);

module.exports = mongoose.connection;
