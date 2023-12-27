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
              </div>
            ))}
            {groups.map((group, index) => (
              <div
                key={group._id}
                className={`group ${index === currentSelected ? "selected" : ""}`}
                onClick={() => changeCurrentChat(index, group)}
              >
                <div className="group-avatar">
                  <span className="avatar-letter">G</span>
                </div>
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
                <div className="room-avatar">
                  <span className="avatar-letter">R</span>
                </div>
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
  background-color: #2b2b2b;

  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;

    img {
      height: 2rem;
    }

    h3 {
      color: #4caf50;
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
      background-color: #373737;
      min-height: 5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1rem;



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

      .status-indicator {
        height: 0.8rem;
        width: 0.8rem;
        border-radius: 50%;
        background-color: #4caf50; /* Default to online color */
      }
    }

    .group {
      background-color: #373737;
      min-height: 5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1rem;



      .group-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #2196f3; /* Adjust the color as needed */
        border-radius: 50%;
        height: 3rem;
        width: 3rem;
        margin-right: 1rem;

        .avatar-letter {
          color: white;
          font-size: 1rem;
        }
      }

      .group-name {
        h3 {
          color: white;
        }
      }
    }

    .room {
      background-color: #373737;
      min-height: 5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1rem;



      .room-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: green; /* Adjust the color as needed */
        border-radius: 50%;
        height: 3rem;
        width: 3rem;
        margin-right: 1rem;

        .avatar-letter {
          color: white;
          font-size: 1rem;
        }
      }

      .room-name {
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
  width:30%

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
      width: 30%;



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
      padding: 0.8rem; /* Increased padding for a larger button */
      border-radius: 0.3rem;
      cursor: pointer;
    }
  }
`;
