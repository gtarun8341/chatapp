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
} from "../utils/APIRoutes";
const socket = io(host); // Replace with your server URL

export default function Contacts({ contacts, groups, changeChat }) {
  const [currentUserName, setCurrentUserName] = useState(undefined);
  const [currentUserImage, setCurrentUserImage] = useState(undefined);
  const [currentUserId, setCurrentUserId] = useState(undefined);
  const [currentSelected, setCurrentSelected] = useState(undefined);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGroupCreation, setShowGroupCreation] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [onlineStatus, setOnlineStatus] = useState({});

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

  return (
    <>
      {currentUserImage && currentUserImage && (
        <Container>
          <div className="brand">
            <img src={Logo} alt="logo" />
            <h3>snappy</h3>
            <DropdownButton title="" id="dropdown-menu" className="dots" variant="light">
              <Dropdown.Item onClick={toggleGroupCreation}>Create Group</Dropdown.Item>
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
      height: 2.5rem;
    }

    h3 {
      color: white;
      font-size: 1.5rem;
    }
  }

  .contacts {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: auto;
    gap: 1rem;

    &::-webkit-scrollbar {
      width: 0.5rem;

      &-thumb {
        background-color: #ffffff39;
        width: 0.3rem;
        border-radius: 1rem;
      }
    }

    .contact,
    .group {
      background-color: #ffffff34;
      min-height: 5rem;
      cursor: pointer;
      padding: 1rem;
      border-radius: 0.5rem;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: background-color 0.3s ease;

      &:hover {
        background-color: #ffffff63;
      }

      .avatar {
        img {
          height: 3rem;
          width: 3rem;
          border-radius: 50%;
        }
      }

      .username,
      .group-name {
        h3 {
          color: white;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 150px;
          font-size: 1rem;
        }
      }

      &.online {
        border-left: 0.4rem solid #4caf50;
      }

      &.offline {
        border-left: 0.4rem solid #f44336;
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
        font-size: 1.2rem;
      }
    }

    .dots {
      background-color: transparent;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
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
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);

  h3 {
    color: white;
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }

  .contact-list {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;

    .contact {
      background-color: #ffffff34;
      min-height: 5rem;
      cursor: pointer;
      padding: 1rem;
      border-radius: 0.5rem;
      width: calc(25% - 1rem);
      transition: background-color 0.3s ease;

      &:hover {
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
          max-width: 150px;
          font-size: 1rem;
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
        font-size: 1rem;
      }

      input {
        background-color: #ffffff34;
        color: white;
        border: none;
        border-radius: 0.3rem;
        padding: 0.5rem;
        font-size: 1rem;
      }
    }

    button {
      background-color: #4caf50;
      color: white;
      border: none;
      padding: 0.5rem;
      border-radius: 0.3rem;
      font-size: 1rem;
      cursor: pointer;
    }
  }
`;

