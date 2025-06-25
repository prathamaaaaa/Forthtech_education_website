// socketHandler.js
const PublicMessage = require('../models/PublicMessage');
const PrivateMessage = require('../models/PrivateMessage');
const GroupMessage = require('../models/GroupMessage');
const handleSocketConnection = (io, socket, onlineUsers) => {
  const userId = socket.handshake.auth?.userId;

  if (userId) {
    onlineUsers.set(userId, socket.id);
    console.log(`🟢 ${userId} connected as ${socket.id}`);
  }

  socket.on("setup", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`🧑‍💻 User ${userId} is online with socket ${socket.id}`);
  });

  // Load public history
  PublicMessage.find().sort({ timestamp: 1 }).limit(100).then((messages) => {
    socket.emit('public-chat-history', messages);
  });

  socket.on('public-message', async ({ sender, message }) => {
    const msg = new PublicMessage({ sender, message });
    await msg.save();
    io.emit('public-message', {
      sender,
      message,
      timestamp: msg.timestamp
    });
  });

  socket.on("send-invite", ({ fromId, toId }) => {
    const receiverSocketId = onlineUsers.get(toId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive-invite", { fromId });
    }
  });

  socket.on("send-message", async ({ senderId, receiverId, message }) => {
    const msg = await PrivateMessage.create({ senderId, receiverId, message });
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive-message", msg);
    }
    socket.emit("message-sent", msg);
  });

  socket.on("load-messages", async ({ currentUserId, selectedUserId }) => {
    const messages = await PrivateMessage.find({
      $or: [
        { senderId: currentUserId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: currentUserId },
      ],
    }).sort({ timestamp: 1 });
    socket.emit("message-history", messages);
  });

  socket.on("contact-accepted", ({ fromId, toId, user }) => {
    const toSocketId = onlineUsers.get(toId);
    if (toSocketId) {
      io.to(toSocketId).emit("contact-accepted", { user });
    }
  });



   socket.on("load-group-messages", async ({ groupId }) => {
    try {
      const msgs = await GroupMessage.find({ groupId })
        .populate("senderId", "firstName lastName _id")
        .sort({ timestamp: 1 });
      socket.emit("group-message-history", msgs);
    } catch (err) {
      console.error("Failed to load group messages:", err);
    }
  });



    socket.on("send-group-message", async (msg) => {
    try {
      const saved = await GroupMessage.create(msg);
      const populated = await saved.populate("senderId", "firstName lastName _id");
      io.emit("receive-group-message", populated); // Broadcast to all
    } catch (err) {
      console.error("Failed to save group message:", err);
    }
  });
  socket.on("disconnect", () => {
    console.log(`🔴 ${socket.id} disconnected`);
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
  });
};

module.exports = handleSocketConnection;
