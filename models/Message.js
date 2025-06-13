const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  content: String,
  room: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
