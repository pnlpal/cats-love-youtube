const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Mongo config
const mongoURL = "mongodb://localhost:27017";
const dbName = "cats-love-youtube";
let db;

MongoClient.connect(mongoURL, { useUnifiedTopology: true }, (err, client) => {
  if (err) {
    console.log("Mongo connection error", err);
    throw err;
  }

  console.log("Connected to MongoDB");
  db = client.db(dbName);

  const Comment = db.collection("Comment");
  Comment.createIndex({ videoId: 1, start: 1, createdAt: 1 });
});

// Express routes
app.get("/", (req, res) => {
  res.send("Hello world");
});

// Mongo
const createUser = async (username) => {
  // const User = db.collection("User");

  try {
    if (username.length < 75) {
      // User.insertOne({ username });
      return username;
    } else {
      throw new Error("Username is too long!");
    }
  } catch (err) {
    console.log("Error creating user:", err);
  }
};

const handleMessage = ({ start, text, username, videoId }, io, socket) => {
  const Comment = db.collection("Comment");

  try {
    const ret = {
      start,
      text,
      username,
      createdAt: new Date(),
      videoId,
    };

    Comment.insertOne(ret);
    socket.to(videoId).emit("comment", ret);
  } catch (err) {
    console.log("Error handling comment:", err);
  }
};

const getMessages = async (videoId) => {
  try {
    const Comment = db.collection("Comment");
    return await Comment.find({ videoId })
      .sort({ start: 1, createdAt: 1 })
      .toArray();
  } catch (err) {
    console.log("Error getting messages", err);
  }
};

// Socket.io
io.on("connection", (socket) => {
  console.log("Connection started...");

  socket.on("register", (data) => {
    console.log("'register' received:", data);
    createUser(data)
      .then((username) => {
        socket.emit("registerred", username);
      })
      .catch((err) => {
        socket.emit("error", err);
      });
  });

  socket.on("message", (data) => {
    console.log("'message' received:", data);
    handleMessage(data, io, socket);
  });

  socket.on("joinRoom", (videoId) => {
    socket.join(videoId);
    console.log(`User with ID ${socket.id} joined room ${videoId}`);

    getMessages(videoId)
      .then((comments) => {
        socket.emit("comments", comments);
      })
      .catch((err) => {
        socket.emit("error", err);
      });
  });

  socket.on("leaveRoom", (videoId) => {
    socket.leave(videoId);
    console.log(`User with ID ${socket.id} left room ${videoId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

httpServer.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
