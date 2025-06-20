const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  message: String,
  read: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PrivateMessage', privateMessageSchema);
