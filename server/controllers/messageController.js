const Messages = require("../models/messageModel");

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    console.log("from:", from);
    console.log("to:", to);

    const messages = await Messages.find({
      chatType: "one-to-one",

      userIds: {
        $all: [from, to],
      },
    }).sort({ updatedAt: 1 });


    const projectedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === from,
        message: msg.message.text,
      };
    });

    console.log("projectedMessages:", projectedMessages);

    res.json(projectedMessages);
  } catch (ex) {
    console.error(ex);
    res.status(500).json({ msg: "Internal Server Error" });
  }
};



module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message } = req.body;
    const data = await Messages.create({
      message: { text: message },
      chatType: "one-to-one",
      userIds: [from, to],
      sender: from,
    });

    console.log(" one");

    if (data) return res.json({ msg: "One-to-one message added successfully." });
    else return res.json({ msg: "Failed to add one-to-one message to the database" });
  } catch (ex) {
    next(ex);
  }
};
