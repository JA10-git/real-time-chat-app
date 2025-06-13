const express = require("express");
const http = require("http");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Message = require("./models/Message");

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// Session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // security best practice
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
});

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(express.static("public"));

// Share session with Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// GET login page
app.get("/", (req, res) => {
  if (req.session.username) {
    return res.redirect("/chat.html");
  }
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// POST login
app.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === "") {
    return res.redirect("/");
  }

  req.session.username = username;
  res.redirect("/chat.html");
});

// Socket.IO connection
io.on("connection", (socket) => {
  const session = socket.request.session;
  const username = session.username;

  if (!username) return;

  socket.broadcast.emit("user-status", `${username} is online`);

  socket.on("join-room", (room) => {
    socket.join(room);
  });

  socket.on("chat-message", async ({ room, message }) => {
    const msg = new Message({ sender: username, content: message, room });
    await msg.save();
    io.to(room).emit("chat-message", {
      sender: username,
      message,
      time: new Date().toLocaleTimeString(),
    });
  });

  socket.on("typing", (room) => {
    socket.to(room).emit("typing", `${username} is typing...`);
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("user-status", `${username} disconnected`);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
