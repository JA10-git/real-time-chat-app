const socket = io();
const form = document.getElementById("message-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const typing = document.getElementById("typing-indicator");
const status = document.getElementById("status");

const room = "global";
socket.emit("join-room", room);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = input.value.trim();
  if (msg) {
    socket.emit("chat-message", { room, message: msg });
    input.value = "";
  }
});

input.addEventListener("input", () => {
  socket.emit("typing", room);
});

socket.on("chat-message", ({ sender, message, time }) => {
  const msgEl = document.createElement("div");
  msgEl.textContent = `[${time}] ${sender}: ${message}`;
  messages.appendChild(msgEl);
  messages.scrollTop = messages.scrollHeight;
});

socket.on("typing", (msg) => {
  typing.textContent = msg;
  setTimeout(() => typing.textContent = "", 1000);
});

socket.on("user-status", (msg) => {
  status.textContent = msg;
});
