
export const host = "https://chatapp-red-five.vercel.app";
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

export const recieveRoomMessageRoute = `${host}/api/messages/recieve-room-msg`;
export const sendRoomMessageRoute = `${host}/api/messages/send-room-msg`;


