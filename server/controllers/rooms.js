// controllers/rooms.js
const Room = require('../models/Room');

const createRoom = async (req, res) => {
  const { roomName } = req.body;

  try {
    const newRoom = new Room({ roomName, users: [] });
    await newRoom.save();

    res.status(201).json({ message: 'Room created successfully', roomId: newRoom._id });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({}, 'roomName');
    res.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const joinRoom = async (req, res) => {
  const { roomId, userId } = req.body;

  try {
    const room = await Room.findById(roomId);

    if (room) {
      room.users.push(userId);
      await room.save();

      res.json({ message: 'Joined the room successfully' });
    } else {
      res.status(404).json({ message: 'Room not found' });
    }
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { createRoom, getRooms, joinRoom };
