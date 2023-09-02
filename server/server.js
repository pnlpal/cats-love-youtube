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
let db, Comment;

MongoClient.connect(mongoURL, { useUnifiedTopology: true }, (err, client) => {
  if (err) {
    console.log("Mongo connection error", err);
    throw err;
  }

  console.log("Connected to MongoDB");
  db = client.db(dbName);

  Comment = db.collection("Comment");
  Comment.createIndex({ videoId: 1, start: 1, createdAt: 1 });
});

// Express routes
app.get("/", (req, res) => {
  res.send("Hello world");
});

// Mongo
const createUser = async ({ username, videoId }) => {
  if (username.length > 75) {
    throw new Error("Username is too long!");
  }
  if (await Comment.findOne({ username, videoId })) {
    throw new Error(`${username} has been taken. Please choose another name!`);
  }

  return username;
};

const handleMessage = async ({ start, text, username, videoId }, socket) => {
  try {
    if (!text?.length || !videoId?.length || !username?.length) {
      throw new Error("Comment is invalid!");
    }
    if (text.length > 140) {
      throw new Error("Please don't comment over 140 characters!");
    }

    const ret = {
      start,
      text,
      username,
      createdAt: new Date(),
      videoId,
    };

    await Comment.insertOne(ret);
    socket.to(videoId).emit("comment", ret);
    socket.emit("comment", ret);
  } catch (err) {
    console.error("Error handling comment:", err);
    socket.emit("error", { message: err.message });
  }
};

const getMessages = async (videoId) => {
  try {
    return await Comment.find({ videoId })
      .sort({ start: 1, createdAt: 1 })
      .toArray();
  } catch (err) {
    console.error("Error getting messages", err);
    socket.emit("error", { message: err.message });
  }
};

// Socket.io
io.on("connection", (socket) => {
  console.log("Connection started...");

  socket.on("register", ({ username, videoId }) => {
    createUser({ username, videoId })
      .then((username) => {
        socket.emit("registerred", username);
      })
      .catch((err) => {
        console.error(err);
        socket.emit("error", { message: err.message });
      });
  });

  socket.on("message", (data) => {
    console.log("'message' received:", data);
    handleMessage(data, socket);
  });

  socket.on("joinRoom", (videoId) => {
    socket.join(videoId);
    console.log(`User with ID ${socket.id} joined room ${videoId}`);

    getMessages(videoId)
      .then((comments) => {
        socket.emit("comments", comments);
      })
      .catch((err) => {
        console.error(err);
        socket.emit("error", { message: err.message });
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
