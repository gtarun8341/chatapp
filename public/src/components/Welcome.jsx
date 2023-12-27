import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Robot from "../assets/robot.gif";
import Logout from "./Logout";

export default function Welcome() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const storedData = JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
    if (storedData && storedData.username) {
      setUserName(storedData.username);
    }
  }, []);

  return (
    <Container>
      <TopRight>
        <Logout />
      </TopRight>
      <RobotImage src={Robot} alt="Robot" />
      <WelcomeText>
        Welcome, <UserName>{userName}!</UserName>
      </WelcomeText>
      <SubHeading>Please select a chat to start messaging.</SubHeading>
    </Container>
  );
}

const Container = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #333;
  background-color: grey;
  height: 100%;
  flex-direction: column;
`;

const TopRight = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
`;

const RobotImage = styled.img`
  height: 20rem;
`;

const WelcomeText = styled.h1`
  margin: 1rem 0;
  font-size: 2rem;
  text-align: center;

  @media screen and (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const UserName = styled.span`
  color: #4e0eff;
`;

const SubHeading = styled.h3`
  text-align: center;
  font-size: 1.2rem;
  max-width: 400px;
  margin-top: 0.5rem;
`;
