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
  sendRoomMessageRoute,
  recieveRoomMessageRoute,
} from "../utils/APIRoutes";

export default function ChatContainer({ currentChat, socket }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [roomMessages, setRoomMessages] = useState([]);
  useEffect(async () => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );

    if (currentChat) {
      try {
        if ("roomName" in currentChat) {
          const response = await axios.post(recieveRoomMessageRoute, {
            roomId: currentChat._id,
            userId: data._id,
          });
          setMessages(response.data);
        } else if ("groupName" in currentChat) {
          const response = await axios.post(recieveGroupMessageRoute, {
            groupId: currentChat._id,
            userId: data._id,
          });
          setMessages(response.data);
        } else if ("_id" in currentChat) {
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
          socket.current.emit("send-room-msg", {
            roomId: currentChat._id,
            from: data._id,
            msg,
          });
          await axios.post(sendRoomMessageRoute, {
            from: data._id,
            roomId: currentChat._id,
            message: msg,
            fromname:data.username,
          });

          setMessages((prevMessages) => [
            ...prevMessages,
            { fromSelf: true, message: msg },
          ]);
        } else if ("groupName" in currentChat) {
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
            fromname:data.username,
          });

          setMessages((prevMessages) => [
            ...prevMessages,
            { fromSelf: true, message: msg },
          ]);
        } else if ("_id" in currentChat) {
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

          setMessages((prevMessages) => [
            ...prevMessages,
            { fromSelf: true, message: msg },
          ]);
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
  }, [messages]);


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
          <h3>{currentChat.username || currentChat.roomName || currentChat.groupName}</h3>
          </div>
        </div>
        <Logout />
      </div>
      <div className="chat-messages">
      {currentChat.chatType === "room" &&
        roomMessages.map((message, index) => {
          return (
            <div
              ref={index === roomMessages.length - 1 ? scrollRef : null}
              key={uuidv4()}
            >
              <div
                className={`message ${
                  message.fromSelf ? "sended" : "recieved"
                } group`}
              >
                <div className="content">
                  <p>{message.message}</p>
                </div>
              </div>
            </div>
          );
        })}

      {currentChat.chatType === "group" &&
        groupMessages.map((message, index) => {
          return (
            <div
              ref={index === groupMessages.length - 1 ? scrollRef : null}
              key={uuidv4()}
            >
              <div
                className={`message ${
                  message.fromSelf ? "sended" : "recieved"
                } group`}
              >
                <div className="content">
                  <p>{message.message}</p>
                </div>
              </div>
            </div>
          );
        })}

      {currentChat.chatType !== "room" && currentChat.chatType !== "group" &&
        messages.map((message, index) => {
          return (
            <div
              ref={index === messages.length - 1 ? scrollRef : null}
              key={uuidv4()}
            >
              <div
                className={`message ${
                  message.fromSelf ? "sended" : "recieved"
                }`}
              >
                <div className="content">
                  <p>{message.message}</p>
                </div>
              </div>
            </div>
          );
        })}
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
    background:black;
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
      margin-bottom: 0; /* Remove margin-bottom */
      .content {
        max-width: 40%;
        overflow-wrap: break-word;
        padding: 1rem;
        font-size: 1.1rem;
        border-radius: 1rem;
        color: black; /* Change text color to black */
        @media screen and (min-width: 720px) and (max-width: 1080px) {
          max-width: 70%;
        }
      }
    }
    .sender-name {
      font-size: 0.8rem; // Adjust the font size as needed
      color: black; // Optional: You can customize the color
      text-align: ${props => (props.fromSelf ? "right" : "left")};
    }
    .sended {
      justify-content: flex-end;
      .content {
        background-color: red;
      }
    }
    .recieved {
      justify-content: flex-start;
      .content {
        background-color: grey;
      }
    }
    .group {
      /* Add styling for group messages here */
    }
    .room {
      /* Add styling for room messages here */
    }
  }
`;
