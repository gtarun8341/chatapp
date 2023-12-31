// server/index.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { ObjectId } = require('mongodb');
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const bodyParser = require('body-parser');
const Messages = require('./models/messageModel'); // Import your Messages model

const app = express();
const socket = require("socket.io");
require("dotenv").config();

app.use(cors({
  origin: 'https://chatapp-vaba.vercel.app',
  credentials: true,
  methods: 'GET,PUT,POST,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization'
}));
app.use(express.json());
app.use(bodyParser.json());

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connection Successful");
  })
  .catch((err) => {
    console.log(err.message);
  });

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

const groupSchema = new mongoose.Schema({
  groupName: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const Group = mongoose.model('Group', groupSchema);
const roomSchema = new mongoose.Schema({
  roomName: String,

});

const Room = mongoose.model('Room', roomSchema);

const roomMessages = {};

app.post('/api/rooms', async (req, res) => {
  try {
    const { roomName } = req.body;

    // Create a new room
    const newRoom = new Room({ roomName });
    const savedRoom = await newRoom.save();

    res.status(201).json(savedRoom);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/messages/recieve-room-msg', async (req, res) => {
  try {
    const { roomId } = req.body;

    const messages = await Messages.find({
      roomId: roomId,
    }).sort({ updatedAt: 1 });
    console.log("room meesages recieve");

    if (!messages) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const projectedMessages = messages.map((msg) => {
      return {
        chatType:"room",
        fromSelf: msg.sender.toString() === req.body.userId,
        message: msg.message.text,
        username:msg.Name,
      };
    });

    res.json(projectedMessages);
  } catch (error) {
    console.error('Error fetching room messages:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/api/rooms', async (req, res) => {
  try {
    const allRooms = await Room.find().exec();
    res.status(200).json(allRooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Group Endpoint
app.post('/api/groups', async (req, res) => {
  try {
    const { currentUserId, groupName, members, current } = req.body;

    // Include the creator's _id in the members array
    const creatorId = currentUserId;
    const memberIds = [...members, creatorId];

    // Create a new group
    const newGroup = new Group({ groupName, members: memberIds });
    const savedGroup = await newGroup.save();

    res.status(201).json(savedGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/groups/user-groups', async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId(req.query.userId);

    const userGroups = await Group.find({
      members: userId
    }).exec();

    res.status(200).json(userGroups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/api/messages/send-group-msg', async (req, res,next) => {
  try {
    const { from, groupId, message, users,fromname} = req.body;
    const data = await Messages.create({
      message: { text: message },
      chatType: "group",
      groupId: groupId,
      userIds: users,
      sender: from,
      Name:fromname,
    });

    console.log("group");

    if (data) return res.json({ msg: "Group message added successfully." });
    else return res.json({ msg: "Failed to add group message to the database" });
  } catch (ex) {
    next(ex);
  }
});

app.post('/api/messages/recieve-group-msg', async (req, res, next) => {
  try {
    const groupId = mongoose.Types.ObjectId(req.body.groupId);

    const messages = await Messages.find({
      groupId: groupId,
    }).sort({ updatedAt: 1 });

    console.log("group recieve");

    const projectedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === req.body.userId,
        message: msg.message.text,
        username:msg.Name,
      };
    });

    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
});


function getKeyByValue(map, value) {
  return [...map.entries()].find(([key, val]) => val === value)?.[0];
}

function broadcastOnlineStatus() {
  const onlineStatus = Array.from(onlineUsers).reduce((status, [userId, socketId]) => {
    const isSocketConnected = io.sockets.connected && io.sockets.connected[socketId];
    status[userId] = isSocketConnected ? 'online' : 'offline';
    return status;
  }, {});

  io.emit("update-online-status", onlineStatus);
}

const server = app.listen(process.env.PORT, () =>
  console.log(`Server started on ${process.env.PORT}`)
);

const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

global.onlineUsers = new Map();
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    // Send existing room messages to the joining user
    io.to(socket.id).emit('recieve-room-msg', roomMessages[roomId]);
  });

  socket.on('send-room-msg', ({ roomId, userId, message }) => {
    // Add the message to the room
    const room = roomMessages[roomId] || [];
    room.push({ sender: userId, message });
    roomMessages[roomId] = room;

    // Broadcast the room message to all connected clients in the room
    io.to(roomId).emit('room-msg-recieve', { sender: userId, message });
  });

  socket.on('add-user', (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} connected`);
    broadcastOnlineStatus();
  });

  socket.on('disconnect', () => {
    const userId = getKeyByValue(onlineUsers, socket.id);
    onlineUsers.delete(userId);
    broadcastOnlineStatus();
    console.log(`User ${userId} disconnected`);
  });

  socket.on('send-msg', (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit('msg-recieve', data.msg);
      console.log(`Message sent from ${data.from} to ${data.to}: ${data.msg}`);
    }
  });
});

app.get('/api/users/online-status', (req, res) => {
  try {
    const userIds = Array.from(onlineUsers.keys());
    const onlineStatus = userIds.reduce((status, userId) => {
      status[userId] = onlineUsers.has(userId) ? 'online' : 'offline';
      return status;
    }, {});

    res.status(200).json(onlineStatus);
  } catch (error) {
    console.error('Error fetching online status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/messages/send-room-msg', async (req, res) => {
  try {
    const { roomId } = req.body;
    const { from, message,fromname } = req.body;
    console.log("entered",req.body);

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const data = await Messages.create({
      message: { text: message },
      chatType: "room",
      roomId: roomId,
      sender: from,
      Name:fromname,
    });

    console.log("room");
        // Broadcast the room message to all connected clients in the room
    io.to(roomId).emit('room-msg-recieve', { sender: from, message });

    if (data) return res.json({ msg: "room message added successfully." });
    else return res.json({ msg: "Failed to add room message to the database" });


  } catch (error) {
    console.error('Error sending room message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
