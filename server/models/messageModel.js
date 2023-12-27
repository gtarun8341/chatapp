const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema(
  {
    message: {
      text: { type: String, required: true },
    },
    chatType: {
      type: String,
      enum: ["one-to-one", "group", "room"],
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    userIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    Name: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Message", MessageSchema);
