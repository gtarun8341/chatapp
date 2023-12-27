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

app.use(cors());
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
    console.log("entered not",req.body,messages);

    if (!messages) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const projectedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === req.body.userId,
        message: msg.message.text,
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


app.post('/api/messages/send-group-msg', async (req, res) => {
  try {
    const { from, groupId, message, users} = req.body;
    const data = await Messages.create({
      message: { text: message },
      chatType: "group",
      groupId: groupId,
      userIds: users,
      sender: from,
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

    console.log("group recieve",messages);

    const projectedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === req.body.userId,
        message: msg.message.text,
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
    const { from, message } = req.body;
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




import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled from "styled-components";
import { allUsersRoute, host } from "../utils/APIRoutes";
import ChatContainer from "../components/ChatContainer";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();
  const [contacts, setContacts] = useState([]);
  const [currentChat, setCurrentChat] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(async () => {
    if (!localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)) {
      navigate("/login");
    } else {
      setCurrentUser(
        await JSON.parse(
          localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
        )
      );
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      socket.current = io(host);
      socket.current.emit("add-user", currentUser._id);
    }
  }, [currentUser]);

  useEffect(async () => {
    if (currentUser) {
      if (currentUser.isAvatarImageSet) {
        // Fetch users
        const userData = await axios.get(`${allUsersRoute}/${currentUser._id}`);
        setContacts(userData.data);

        // Fetch groups
        const groupData = await axios.get(`${host}/api/groups/user-groups?userId=${currentUser._id}`);
        setGroups(groupData.data);

        // Fetch rooms
        const roomData = await axios.get(`${host}/api/rooms`);
        setRooms(roomData.data);
      } else {
        navigate("/setAvatar");
      }
    }
  }, [currentUser]);

  const handleChatChange = (chat) => {
    setCurrentChat(chat);
  };

  return (
    <Container>
      <div className="container">
        <Contacts contacts={contacts} groups={groups} rooms={rooms} changeChat={handleChatChange} />
        {currentChat === undefined ? (
          <Welcome />
        ) : (
          <ChatContainer currentChat={currentChat} socket={socket} />
        )}
      </div>
    </Container>
  );
}

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  background-color: #131324;
  .container {
    height: 85vh;
    width: 85vw;
    background-color: #00000076;
    display: grid;
    grid-template-columns: 25% 75%;
    @media screen and (min-width: 720px) and (max-width: 1080px) {
      grid-template-columns: 35% 65%;
    }
  }
`;




import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Logo from "../assets/logo.svg";
import { Dropdown, DropdownButton, Modal, Form, Button } from "react-bootstrap";
import axios from "axios";
import io from "socket.io-client";
import {
  host,
  onlineStatusCheck,
  apiGroups,
  apiRooms,
} from "../utils/APIRoutes";

const socket = io(host); // Replace with your server URL

export default function Contacts({ contacts, groups, rooms, changeChat }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentUserImage, setCurrentUserImage] = useState(undefined);
  const [currentUserId, setCurrentUserId] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGroupCreation, setShowGroupCreation] = useState(false);
  const [showRoomCreation, setShowRoomCreation] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [onlineStatus, setOnlineStatus] = useState({});
  const [roomName, setRoomName] = useState("");

  useEffect(() => {
    const fetchOnlineStatus = async () => {
      try {
        const response = await axios.get(onlineStatusCheck);
        console.log("Online Status Response:", response.data);
        setOnlineStatus(response.data);
      } catch (error) {
        console.error("Error fetching online status:", error);
      }
    };
  
    fetchOnlineStatus();
  }, []);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
    setCurrentUserId(data._id);
    setCurrentUserName(data.username);
    setCurrentUserImage(data.avatarImage);

    const handleBeforeUnload = () => {
      socket.emit("disconnecting", currentUserId);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentUserId]);

  const changeCurrentChat = (index, contact) => {
    setCurrentSelected(index);
    changeChat(contact);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const toggleGroupCreation = () => {
    setShowGroupCreation(!showGroupCreation);
  };

  const toggleRoomCreation = () => {
    setShowRoomCreation(!showRoomCreation);
  };

  const handleContactSelection = (contact) => {
    const isSelected = selectedContacts.includes(contact);
    if (isSelected) {
      setSelectedContacts(selectedContacts.filter((c) => c !== contact));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const handleCreateGroup = async () => {
    try {
      const response = await axios.post(apiGroups, {
        currentUserId,
        groupName,
        members: selectedContacts.map((contact) => contact._id),
      });

      console.log(response.data);

      setGroupName("");
      setSelectedContacts([]);
      toggleGroupCreation();
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleCreateRoom = async () => {
    try {
      // Send a request to create the room on the server
      const response = await axios.post(apiRooms, {
        roomName,
      });
  
      // Handle the response as needed
      console.log(response.data);
  
      // Reset state and close the room creation modal
      setRoomName("");
      toggleRoomCreation();
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  return (
    <>
      {currentUserImage && currentUserImage && (
        <Container>
          <div className="brand">
            <img src={Logo} alt="logo" />
            <h3>snappy</h3>
            <DropdownButton title="" id="dropdown-menu" className="dots" variant="light">
              <Dropdown.Item onClick={toggleGroupCreation}>Create Group</Dropdown.Item>
              <Dropdown.Item onClick={toggleRoomCreation}>Create Room</Dropdown.Item>
            </DropdownButton>
          </div>
          <div className="contacts">
            {contacts.map((contact, index) => (
              <div
                key={contact._id}
                className={`contact ${index === currentSelected ? "selected" : ""} ${onlineStatus[contact._id] === 'online' ? 'online' : 'offline'}`}
                onClick={() => changeCurrentChat(index, contact)}
              >
                <div className="avatar">
                  <img src={`data:image/svg+xml;base64,${contact.avatarImage}`} alt="" />
                </div>
                <div className="username">
                  <h3>{contact.username}</h3>
                </div>
                <div className={`status-indicator`}></div>
              </div>
            ))}
            {groups.map((group, index) => (
              <div
                key={group._id}
                className={`group ${index === currentSelected ? "selected" : ""}`}
                onClick={() => changeCurrentChat(index, group)}
              >
                <div className="group-avatar"></div>
                <div className="group-name">
                  <h3>{group.groupName}</h3>
                </div>
              </div>
            ))}
        {rooms.map((room, index) => (
          <div
            key={room._id}
            className={`room ${index === currentSelected ? "selected" : ""}`}
            onClick={() => changeCurrentChat(index, room)}
          >
            <div className="room-avatar"></div>
            <div className="room-name">
              <h3>{room.roomName}</h3>
            </div>
          </div>
        ))}
          </div>
          <div className="current-user">
            <div className="avatar">
              <img src={`data:image/svg+xml;base64,${currentUserImage}`} alt="avatar" />
            </div>
            <div className="username">
              <h2>{currentUserName}</h2>
            </div>
          </div>
          {showGroupCreation && (
            <GroupCreationContainer>
              <CloseButton onClick={toggleGroupCreation}>X</CloseButton>
              <h3>Select Contacts:</h3>
              <div className="contact-list">
                {contacts.map((contact) => (
                  <div
                    key={contact._id}
                    className={`contact ${selectedContacts.includes(contact) ? "selected" : ""}`}
                    onClick={() => handleContactSelection(contact)}
                  >
                    <div className="avatar">
                      <img src={`data:image/svg+xml;base64,${contact.avatarImage}`} alt="" />
                    </div>
                    <div className="username">
                      <h3 title={contact.username}>{contact.username}</h3>
                    </div>
                  </div>
                ))}
              </div>
              <Form>
                <Form.Group controlId="groupName">
                  <Form.Label>Group Name:</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </Form.Group>
                <Button variant="primary" onClick={handleCreateGroup}>
                  Create
                </Button>
              </Form>
            </GroupCreationContainer>
          )}
{showRoomCreation && (
  <GroupCreationContainer>
    <CloseButton onClick={toggleRoomCreation}>X</CloseButton>
    <h3>Create Room:</h3>
    <Form>
      <Form.Group controlId="roomName">
        <Form.Label>Room Name:</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter room name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
      </Form.Group>
      <Button variant="primary" onClick={handleCreateRoom}>
        Create
      </Button>
    </Form>
  </GroupCreationContainer>
)}

        </Container>
      )}
    </>
  );
}

const CloseButton = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
`;

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 75% 15%;
  overflow: hidden;
  background-color: #080420;

  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;

    img {
      height: 2rem;
    }

    h3 {
      color: white;
      text-transform: uppercase;
    }
  }

  .contacts {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: auto;
    gap: 0.8rem;

    &::-webkit-scrollbar {
      width: 0.2rem;

      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }

    .contact {
      background-color: #ffffff34;
      min-height: 5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1rem;

      &.selected {
        background-color: #ffffff63;
      }

      &.online {
        border-left: 0.4rem solid #4caf50;
      }
    
      &.offline {
        border-left: 0.4rem solid #f44336;
      }

      .avatar {
        img {
          height: 3rem;
          width: 3rem;
          border-radius: 50%;
        }
      }

      .username {
        h3 {
          color: white;
        }
      }
    }

    .group {
      background-color: #ffffff34;
      min-height: 5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1rem;

      &.selected {
        background-color: #ffffff63;
      }

      .group-avatar {
        /* Add styles for group avatar */
      }

      .group-name {
        h3 {
          color: white;
        }
      }
    }
  }

  .current-user {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;

    .avatar {
      img {
        height: 2rem;
        width: 2rem;
        border-radius: 50%;
      }
    }

    .username {
      h2 {
        color: white;
      }
    }

    .dots {
      background-color: transparent;
      border: none;
      color: white;
    }
  }
`;

const GroupCreationContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #080420;
  padding: 2rem;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  h3 {
    color: white;
    margin-bottom: 1rem;
  }

  input {
    background-color: #ffffff34;
    color: white;
    border: none;
    border-radius: 0.3rem;
    padding: 0.5rem;
  }

  .contact-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;

    .contact {
      background-color: #ffffff34;
      min-height: 5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      width: calc(25% - 0.8rem);

      &.selected {
        background-color: #ffffff63;
      }

      .avatar {
        img {
          height: 3rem;
          width: 3rem;
          border-radius: 50%;
        }
      }

      .username {
        h3 {
          color: white;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 150px; /* Adjust the max-width according to your layout */
        }
      }
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .form-group {
      label {
        color: white;
      }

      input {
        background-color: #ffffff34;
        color: white;
        border: none;
        border-radius: 0.3rem;
        padding: 0.5rem;
      }
    }

    button {
      background-color: #4caf50;
      color: white;
      border: none;
      padding: 0.5rem;
      border-radius: 0.3rem;
      cursor: pointer;
    }
  }
`;



import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ChatInput from "./ChatInput";
import Logout from "./Logout";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import {
  sendMessageRoute,
  recieveMessageRoute,
  sendGroupMessageRoute,
  recieveGroupMessageRoute,
  sendRoomMessageRoute,  // Add this route
  recieveRoomMessageRoute,  // Add this route
} from "../utils/APIRoutes";

export default function ChatContainer({ currentChat, socket }) {
  const [messages, setMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);  // Add this state
  const [roomMessages, setRoomMessages] = useState([]);  // Add this state
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);

  useEffect(async () => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
  
    if (currentChat) {
      try {
        if ("roomName" in currentChat) {
          // If it's a room
          const response = await axios.post(recieveRoomMessageRoute, {
            roomId: currentChat._id,
            userId: data._id,
          });
          setRoomMessages(response.data);
        } else if ("groupName" in currentChat) {
          // If it's a group
          const response = await axios.post(recieveGroupMessageRoute, {
            groupId: currentChat._id,
            userId: data._id,
          });
          setGroupMessages(response.data);
        } else if ("_id" in currentChat) {
          // If it's a contact (one-to-one chat)
          const response = await axios.post(recieveMessageRoute, {
            from: data._id,
            to: currentChat._id,
          });
          setMessages(response.data);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    }
  }, [currentChat]);
  

  const handleSendMsg = async (msg) => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );

    if (currentChat) {
      try {
        if ("roomName" in currentChat) {
          // If it's a room
          socket.current.emit("send-room-msg", {
            roomId: currentChat._id,
            from: data._id,
            msg,
          });

          await axios.post("http://localhost:5000/api/messages/send-room-msg", {
            from: data._id,
            roomId: currentChat._id,
            message: msg,
          });
          

          setRoomMessages((prevMessages) => [...prevMessages, { fromSelf: true, message: msg }]);
        } else if ("groupName" in currentChat) {
          // If it's a group
          socket.current.emit("send-group-msg", {
            groupId: currentChat._id,
            from: data._id,
            msg,
          });

          await axios.post(sendGroupMessageRoute, {
            from: data._id,
            groupId: currentChat._id,
            users: currentChat.members,
            message: msg,
          });

          setGroupMessages((prevMessages) => [...prevMessages, { fromSelf: true, message: msg }]);
        } else if ("_id" in currentChat) {
          // If it's a contact (one-to-one chat)
          socket.current.emit("send-msg", {
            to: currentChat._id,
            from: data._id,
            msg,
          });

          await axios.post(sendMessageRoute, {
            from: data._id,
            to: currentChat._id,
            message: msg,
          });

          setMessages((prevMessages) => [...prevMessages, { fromSelf: true, message: msg }]);
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  useEffect(() => {
    if (socket.current) {
      socket.current.on("msg-recieve", (msg) => {
        setArrivalMessage({ fromSelf: false, message: msg });
      });

      socket.current.on("room-msg-recieve", (data) => {
        setArrivalMessage({ fromSelf: data.from === data.sender, message: data.message });
      });
    }
  }, []);

  useEffect(() => {
    arrivalMessage && setMessages((prev) => [...prev, arrivalMessage]);
  }, [arrivalMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, roomMessages, groupMessages]);

  return (
    <Container>
      <div className="chat-header">
        <div className="user-details">
          <div className="avatar">
            <img
              src={`data:image/svg+xml;base64,${currentChat.avatarImage}`}
              alt=""
            />
          </div>
          <div className="username">
            <h3>{currentChat.username}</h3>
          </div>
        </div>
        <Logout />
      </div>
      <div className="chat-messages">
        {(currentChat.chatType === "room"
          ? roomMessages
          : currentChat.chatType === "group"
          ? groupMessages
          : messages
        ).map((message, index) => (
          <div ref={index === (currentChat.chatType === "room" ? roomMessages.length - 1 : messages.length - 1) ? scrollRef : null} key={uuidv4()}>
            <div
              className={`message ${
                message.fromSelf ? "sended" : "recieved"
              } ${currentChat.chatType === "group" ? "group" : ""}`}
            >
              <div className="content ">
                <p>{message.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ChatInput handleSendMsg={handleSendMsg} />
    </Container>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: 10% 80% 10%;
  gap: 0.1rem;
  overflow: hidden;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    grid-template-rows: 15% 70% 15%;
  }
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      .avatar {
        img {
          height: 3rem;
        }
      }
      .username {
        h3 {
          color: white;
        }
      }
    }
  }
  .chat-messages {
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }
    .message {
      display: flex;
      align-items: center;
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 1.1rem;
        border-radius: 1rem;
        color: #d1d1d1;
        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 70%;
        }
      }
    }
    .sended {
      justify-content: flex-end;
      .content {
        background-color: #4f04ff21;
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background-color: #9900ff20;
      }
    }
    .group {
      /* Add styling for group messages here */
    }
  }
`;



export const host = "http://localhost:5000";
export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;
export const allUsersRoute = `${host}/api/auth/allusers`;
export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const recieveMessageRoute = `${host}/api/messages/getmsg`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;
export const userGroupsRoute = `${host}/api/groups/user-groups`;
export const sendGroupMessageRoute = `${host}/api/messages/send-group-msg`; // Add this line
export const recieveGroupMessageRoute = `${host}/api/messages/recieve-group-msg`; // Add this line
export const apiGroups = `${host}/api/groups`;
export const onlineStatusCheck = `${host}/api/users/online-status`;
export const apiRooms = `${host}/api/rooms`;
// APIRoutes.js

export const recieveRoomMessageRoute = `${host}/api/messages/recieve-room-msg`;
export const sendRoomMessageRoute = `${host}/api/messages/send-room-msg`;

// ... other routes

