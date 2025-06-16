const express = require("express");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const http = require("http");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Message = require("./models/Message");
const onlineUsers = new Map(); // key: username, value: socket.id


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

app.get("/privatechat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/privatechat.html"));
});


// POST login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user || !(await user.comparePassword(password))) {
    return res.redirect("/?error=InvalidCredentials");
  }

  req.session.username = user.username;
  res.redirect("/chatmode.html");
});

// GET sign-up page (optional)
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public/signup.html"));
});

// POST signup
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.redirect("/signup?error=MissingFields");
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.redirect("/signup?error=UserExists");
    }

    const user = new User({ username, email, password });
    await user.save();

    req.session.username = user.username;
    res.redirect("/index.html");

  } catch (err) {
    console.error("Signup error:", err);
    res.redirect("/signup?error=ServerError");
  }
});


// Socket.IO connection
io.on("connection", (socket) => {

  const session = socket.request.session;
  const username = session.username;

  onlineUsers.set(username, socket.id);

// Send current user list to requester
socket.emit("user-joined", username); // ✅ send current username to client

socket.on("get-user-list", async () => {
  const allUsers = await User.find({}, "username").lean();
  const userList = allUsers.map(u => ({
    username: u.username,
    online: onlineUsers.has(u.username)
  }));
  socket.emit("user-list", userList);
});


  if (!username) return;

  socket.broadcast.emit("user-status", `${username} is online`);

  socket.on("join-room", (room) => {
    socket.join(room);
  });

  socket.on("disconnect", () => {
  onlineUsers.delete(username);
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
