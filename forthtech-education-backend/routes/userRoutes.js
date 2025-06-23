const express = require('express');
const router = express.Router();
// const io = require('socket.io')(server, { /* options */ });
const User = require('../models/userModel');
const { io, onlineUsers } = require('../app');

router.post('/', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      followList: [],
      requestList: []
    });

    console.log("🎉 New user signed up:", user.email);

    res.status(201).json(user);
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({ error: err.message });
  }
});


router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        const mappedUsers = users.map(u => ({
            id: u._id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email
        }));
        res.json(mappedUsers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/users/:id/request
router.patch('/:id/request', async (req, res) => {
  const fromId = req.params.id; // current user
  const { invitedUserId } = req.body;

  if (fromId === invitedUserId) {
    return res.status(400).json({ error: "You can't invite yourself" });
  }

  const sender = await User.findById(fromId);
  const receiver = await User.findById(invitedUserId);

  if (!sender || !receiver) return res.status(404).json({ error: "User not found" });

  // Check if already invited or followed
  const alreadyInvited = sender.requestList.some(r => r.user.toString() === invitedUserId);
  const alreadyFollowing = sender.followList.includes(invitedUserId);

  if (alreadyInvited || alreadyFollowing) {
    return res.status(400).json({ error: "Already invited or followed" });
  }

  // Add sent request to sender
  sender.requestList.push({ user: invitedUserId, status: 'sent' });

  // Add pending request to receiver
  receiver.requestList.push({ user: fromId, status: 'pending' });

  await sender.save();
  await receiver.save();

  res.status(200).json({ message: "Request sent" });
});


// 🔹 Read Single User
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔹 Update User
router.put('/:id', async (req, res) => {
    try {
        const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated    );
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// POST /api/users/remove-request

router.post('/remove-request', async (req, res) => {
  const { fromId, toId } = req.body;

  try {
    const sender = await User.findById(fromId);
    const receiver = await User.findById(toId);

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove from sender's requestList (status: "sent")
    sender.requestList = sender.requestList.filter(
      (req) => req.user.toString() !== toId
    );

    // Remove from receiver's requestList (status: "pending")
    receiver.requestList = receiver.requestList.filter(
      (req) => req.user.toString() !== fromId
    );

    await sender.save();
    await receiver.save();

    res.status(200).json({ message: 'Request removed' });
  } catch (error) {
    console.error("Remove request error:", error);
    res.status(500).json({ error: 'Server error removing request' });
  }
});
// POST /api/users/accept-request

// router.post('/accept-request', async (req, res) => {
//   const { fromId, toId } = req.body;
//   const io = req.app.get('io');
//   try {
//     const sender = await User.findById(fromId);
//     const receiver = await User.findById(toId);

//     if (!sender || !receiver) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     sender.requestList = sender.requestList.filter(
//       (req) => req.user.toString() !== toId
//     );

//     receiver.requestList = receiver.requestList.filter(
//       (req) => req.user.toString() !== fromId
//     );

//     if (!receiver.followList.includes(fromId)) {
//       receiver.followList.push(fromId);
//     }
//     if (!sender.followList.includes(toId)) {
//       sender.followList.push(toId);
//     }

//     await sender.save();
//     await receiver.save();

//     res.status(200).json({ message: 'Request accepted' });
//   } catch (error) {
//     console.error("Accept request error:", error);
//     res.status(500).json({ error: 'Server error accepting request' });
//   }
// });



// router.post('/accept-request', async (req, res) => {
//   const { fromId, toId } = req.body;
//  const io = req.app.get('io'); 


//   try {
//     const sender = await User.findById(fromId);   // person who sent the request
//     const receiver = await User.findById(toId);   // person who accepted

//     if (!sender || !receiver) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // Clean up request lists
//     sender.requestList = sender.requestList.filter(req => req.user.toString() !== toId);
//     receiver.requestList = receiver.requestList.filter(req => req.user.toString() !== fromId);

//     // Follow each other
//     if (!receiver.followList.includes(fromId)) receiver.followList.push(fromId);
//     if (!sender.followList.includes(toId)) sender.followList.push(toId);

//     await sender.save();
//     await receiver.save();

//     // ✅ Emit system message with names
//     const messageForSender = {
//       fromId: toId,
//       toId: fromId,
//       type: "system",
//       message: `You are now connected with ${receiver.firstName} ${receiver.lastName}`,
//       timestamp: new Date().toISOString()
//     };

//     const messageForReceiver = {
//       fromId: fromId,
//       toId: toId,
//       type: "system",
//       message: `You are now connected with ${sender.firstName} ${sender.lastName}`,
//       timestamp: new Date().toISOString()
//     };

//     io.to(fromId).emit("system-message", messageForSender);
//     io.to(toId).emit("system-message", messageForReceiver);

//     res.status(200).json({ message: 'Request accepted' });
//   } catch (error) {
//     console.error("Accept request error:", error);
//     res.status(500).json({ error: 'Server error accepting request' });
//   }
// });



router.post('/accept-request', async (req, res) => {
  const { fromId, toId } = req.body;
  const io = req.app.get('io');
  const onlineUsers = req.app.get('onlineUsersMap'); 
console.log("Accept ddddddddddddrequest:", { fromId, toId, onlineUsers });
  try {
    const sender = await User.findById(fromId);
    const receiver = await User.findById(toId);

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clean up request lists
    sender.requestList = sender.requestList.filter(req => req.user.toString() !== toId);
    receiver.requestList = receiver.requestList.filter(req => req.user.toString() !== fromId);

    // Follow each other
    if (!receiver.followList.includes(fromId)) receiver.followList.push(fromId);
    if (!sender.followList.includes(toId)) sender.followList.push(toId);

    await sender.save();
    await receiver.save();

    // ✅ Get socket IDs
    const senderSocketId = onlineUsers.get(fromId);
    const receiverSocketId = onlineUsers.get(toId);

    const messageForSender = {
      fromId: toId,
      toId: fromId,
      type: "system",
      message: `You are now connectedddddddddddd with ${receiver.firstName} ${receiver.lastName}`,
      timestamp: new Date().toISOString()
    };

    const messageForReceiver = {
      fromId: fromId,
      toId: toId,
      type: "system",
      message: `You are now connectdddddddddddddddddded with ${sender.firstName} ${sender.lastName}`,
      timestamp: new Date().toISOString()
    };

    if (senderSocketId) io.to(senderSocketId).emit("system-message", messageForSender);
    if (receiverSocketId) io.to(receiverSocketId).emit("system-message", messageForReceiver);
    console.log("✅ System messages sent to both users");
    res.status(200).json({ message: 'Request accepted' });
  } catch (error) {
    console.error("Accept request error:", error);
    res.status(500).json({ error: 'Server error accepting request' });
  }
});


// 🔹 Delete User
router.delete('/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
