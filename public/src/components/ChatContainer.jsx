import React, { useState, useEffect,useRef } from "react";
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
} from "../utils/APIRoutes";

export default function ChatContainer({ currentChat, socket }) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const [arrivalMessage, setArrivalMessage] = useState(null);

  useEffect(async () => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );

    if (currentChat) {
      if ("groupName" in currentChat) {
        // If it's a group
        const response = await axios.post(recieveGroupMessageRoute,{
          groupId:currentChat._id,
          userId:data._id
      });
        setMessages(response.data);
      } else if ("_id" in currentChat) {
        // If it's a contact (one-to-one chat)
        const response = await axios.post(recieveMessageRoute, {
          from: data._id,
          to: currentChat._id,
        });
        setMessages(response.data);
      }
    }
  }, [currentChat]);

  const handleSendMsg = async (msg) => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );

    if (currentChat) {
      try {
        if ("groupName" in currentChat) {
          // If it's a group
          socket.current.emit("send-group-msg", {
            groupId: currentChat._id,
            from: data._id,
            msg,
          });
console.log(currentChat);
          await axios.post(sendGroupMessageRoute, {
            from: data._id,
            groupId: currentChat._id,
            users:currentChat.members,
            message: msg,
          });
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
        } else {
          console.log("Invalid currentChat:", currentChat);
        }

        setMessages((prevMessages) => [...prevMessages, { fromSelf: true, message: msg }]);
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
            <h3>{currentChat.username}</h3>
          </div>
        </div>
        <Logout />
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div ref={index === messages.length - 1 ? scrollRef : null} key={uuidv4()}>
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
          color: black;
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
  }
`;
