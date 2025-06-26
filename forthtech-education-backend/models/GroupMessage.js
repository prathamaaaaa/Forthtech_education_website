const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
   visibleTo: {
    type: [String], // list of userIds who can see the message
    default: [] // empty until created
  }
});

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
