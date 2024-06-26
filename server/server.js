const express = require("express");
const { readFileSync } = require("fs");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

let config = {
  mongo: {
    host: "127.0.0.1",
    port: 27017,
    database: "cats-love-youtube",
  },
};
try {
  config = require("./config.json");
} catch (_) {}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  path: "/cats-love-youtube-socket",
});

const asciiCat = readFileSync(__dirname + "/assets/ascii-cat.txt").toString();

// Mongo config
const mongoAuth = config.mongo.username
  ? `${config.mongo.username}:${config.mongo.password}@`
  : "";
const mongoURL = `mongodb://${mongoAuth}${config.mongo.host}:${config.mongo.port}/${config.mongo.database}`;
let db, Comment, Caption, VideoInfo;

MongoClient.connect(
  process.env.MONGODB || mongoURL,
  {
    useUnifiedTopology: true,
  },
  (err, client) => {
    if (err) {
      console.log("Mongo connection error", err);
      throw err;
    }

    console.log("Connected to MongoDB");
    db = client.db(config.mongo.database);

    Comment = db.collection("Comment");
    Comment.createIndex({ videoId: 1, start: 1, createdAt: 1 });

    Caption = db.collection("Caption");
    Caption.createIndex(
      { videoId: 1, languageCode: 1, languageName: 1 },
      { unique: true }
    );

    VideoInfo = db.collection("VideoInfo");
    VideoInfo.createIndex({ videoId: 1 }, { unique: true });
    VideoInfo.createIndex({ createdAt: 1 });
  }
);

// Express routes
app.get("/", (req, res) => {
  res.send("Hello world");
});

// Mongo
const createUser = async ({ username, videoId }) => {
  if (username.length < 2) {
    throw new Error("Username is too short!");
  }
  if (username.length > 75) {
    throw new Error("Username is too long!");
  }
  if (await Comment.findOne({ username, videoId })) {
    throw new Error(`${username} has been taken. Please choose another name!`);
  }

  return username;
};

const handleError = (socket, label, err) => {
  console.error(label, err);
  socket.emit("error", { message: err.message });
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
    handleError(socket, "Error handling comment", err);
  }
};

const getMessages = async ({ videoId }, socket) => {
  try {
    return await Comment.find({ videoId })
      .sort({ start: 1, createdAt: 1 })
      .toArray();
  } catch (err) {
    handleError(socket, "Error getting messages", err);
  }
};

const getCaptionTracks = async ({ videoId }, socket) => {
  try {
    return await Caption.find(
      { videoId },
      { projection: { languageCode: 1, languageName: 1, _id: 0 } }
    ).toArray();
  } catch (err) {
    handleError(socket, "Error getting cations", err);
  }
};
const getCaption = async ({ videoId, languageCode, languageName }, socket) => {
  try {
    return await Caption.findOne({ videoId, languageCode, languageName });
  } catch (err) {
    handleError(
      socket,
      `Error getting cation of ${languageName}(${languageCode})`,
      err
    );
  }
};

const handleCaption = async (
  { videoId, languageCode, languageName, xml },
  socket
) => {
  try {
    if (
      !languageCode?.length ||
      !languageName?.length ||
      !videoId?.length ||
      !xml?.length
    ) {
      throw new Error("Caption is invalid!");
    }

    return await Caption.insertOne({
      videoId,
      languageCode,
      languageName,
      xml,
    });
  } catch (err) {
    handleError(
      socket,
      "Error handling caption of " +
        videoId +
        " Of " +
        `${languageName}(${languageCode})`,
      err
    );
  }
};
const getVideoInfo = async ({ videoId }, socket) => {
  try {
    return await VideoInfo.findOne({ videoId });
  } catch (err) {
    handleError(socket, `Error getting video info of ${videoId}`, err);
  }
};
const handleVideoInfo = async (
  { videoId, title, snapshot, shortDescription },
  socket
) => {
  try {
    if (!title?.length || !snapshot?.length || !videoId?.length) {
      throw new Error("VideoInfo is invalid!");
    }

    return await VideoInfo.insertOne({
      videoId,
      title,
      snapshot,
      shortDescription,
      createdAt: new Date(),
    });
  } catch (err) {
    handleError(socket, "Error handling video info of " + videoId, err);
  }
};

// Socket.io
io.on("connection", (socket) => {
  console.log("Connection started...");

  socket.emit("welcome", { asciiCat });

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

  socket.on("getComments", (data, callback) => {
    getMessages(data, socket).then(callback);
  });

  socket.on("message", (data) => {
    console.log("'message' received:", data);
    handleMessage(data, socket);
  });
  socket.on("getCaptionTracks", (data, callback) => {
    getCaptionTracks(data, socket).then(callback);
  });
  socket.on("getCaption", (data, callback) => {
    getCaption(data, socket).then(callback);
  });
  socket.on("handleCaption", (data, callback) => {
    handleCaption(data, socket).then(callback);
  });
  socket.on("getVideoInfo", (data, callback) => {
    getVideoInfo(data, socket).then(callback);
  });
  socket.on("handleVideoInfo", (data, callback) => {
    handleVideoInfo(data, socket).then(callback);
  });

  socket.on("joinRoom", ({ videoId }) => {
    socket.join(videoId);
    console.log(`User with ID ${socket.id} joined room ${videoId}`);
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
