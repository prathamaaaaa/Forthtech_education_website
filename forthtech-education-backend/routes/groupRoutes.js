const express = require('express');
const router = express.Router();
const Group = require('../models/Group'); // Ensure this path is correct

router.get('/', async (req, res) => {
  const { userId } = req.query;

  try {
    let query = {};
    if (userId) {
      query = {
        $or: [
          { creator: userId },
          { members: userId }
        ]
      };
    }

    const groups = await Group.find(query)
      .populate('members', 'firstName lastName email')
      .populate('creator', 'firstName lastName email') 
      .populate('joinRequests', 'firstName lastName email');

    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Create a group
router.post('/create', async (req, res) => {
  try {
    const { name, description, category, creatorId, members, progress, nextMeeting, activeDiscussions, isPrivate } = req.body;


    const avatars = members.map(() => 'https://github.com/shadcn.png');

    const newGroup = await Group.create({
      name,
      description,
      category,
      creator: creatorId,
      members,
      progress,
      nextMeeting,
      activeDiscussions,
      memberAvatars: avatars,
      isPrivate
    });

    res.status(201).json(newGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:groupId/reject-request
router.post('/:groupId/reject-request', async (req, res) => {
  const { userId } = req.body;
  console.log('Rejecting request for userId:', userId);
  console.log('Group ID:', req.params.groupId);
  if (!userId) {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    console.log('Before rejection (joinRequests IDs):', group.joinRequests.map(id => id.toString()));

    const newJoinRequests = group.joinRequests.filter(
      (id) => id.toString() !== userId
    );

    if (newJoinRequests.length === group.joinRequests.length) {
      return res.status(400).json({ message: 'User not in join requests or already processed.' });
    }

    group.joinRequests = newJoinRequests; // Update the array

    await group.save(); // Save the modified group document
    console.log('After rejection (joinRequests IDs):', group.joinRequests.map(id => id.toString()));

    res.status(200).json({ message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ message: 'Failed to reject request' });
  }
});

// POST /api/groups/:groupId/accept-request
router.post('/:groupId/accept-request', async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Check if user is already a member
    if (group.members.includes(userId)) {
      return res.status(400).json({ message: 'User is already a member of this group.' });
    }

    // Add user to members
    group.members.push(userId);
    group.memberAvatars.push('https://github.com/shadcn.png'); // Add a default avatar

    // Remove user from joinRequests
    group.joinRequests = group.joinRequests.filter(
      id => id.toString() !== userId
    );

    await group.save();
    res.status(200).json({ message: 'User added to group and request accepted' });
  } catch (err) {
    console.error('Error accepting request:', err);
    res.status(500).json({ message: 'Failed to accept request' });
  }
});

// POST /api/groups/:groupId/join
router.post('/:groupId/join', async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) return res.status(404).json({ message: 'Group not found' });

    const alreadyMember = group.members.includes(userId);
    const alreadyRequested = group.joinRequests.includes(userId);

    if (alreadyMember) {
      return res.status(400).json({ message: 'You are already a member of this group.' });
    }

    if (group.isPrivate) {
      if (alreadyRequested) {
        return res.status(400).json({ message: 'Join request already sent for this private group.' });
      }

      group.joinRequests.push(userId);
      await group.save();
      return res.status(200).json({ message: 'Join request sent for private group. Awaiting creator approval.' });
    } else {
      // For public groups, directly add as a member
      group.members.push(userId);
      group.memberAvatars.push('https://github.com/shadcn.png'); // optional, but consistent
      await group.save();
      return res.status(200).json({ message: 'Successfully joined the public group.' });
    }
  } catch (err) {
    console.error('Error joining group:', err);
    res.status(500).json({ message: 'Failed to join group' });
  }
});

module.exports = router;
