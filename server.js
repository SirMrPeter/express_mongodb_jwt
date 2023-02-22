require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const Message = require("./model/Message");
const corsOptions = require("./config/corsOptions");
const { logger } = require("./middleware/logEvents");
const errorHandler = require("./middleware/errorHandler");
const verifyJWT = require("./middleware/verifyJWT");
const cookieParser = require("cookie-parser");
const credentials = require("./middleware/credentials");
const mongoose = require("mongoose");
const connectDB = require("./config/dbConn");
const User = require("./model/User");
const Conversation = require("./model/Conversation");
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 3500;
const socketIOPort = process.env.SOCKETIO_PORT || 4000;

// Connect to MongoDB
connectDB();

// custom middleware logger
app.use(logger);

// Handle options credentials check - before CORS!
// and fetch cookies credentials requirement
app.use(credentials);

// Cross Origin Resource Sharing
app.use(cors(corsOptions));

// built-in middleware to handle urlencoded form data
app.use(express.urlencoded({ extended: false }));

// built-in middleware for json
app.use(express.json());

//middleware for cookies
app.use(cookieParser());

//serve static files
app.use("/", express.static(path.join(__dirname, "/public")));

// routes
app.use("/", require("./routes/root"));
app.use("/register", require("./routes/register"));
app.use("/auth", require("./routes/auth"));
app.use("/refresh", require("./routes/refresh"));
app.use("/logout", require("./routes/logout"));


app.use(verifyJWT);
<<<<<<< HEAD
app.use("/groups", require("./routes/api/groups"));
app.use("/users", require("./routes/api/users"));
app.use("/courses", require("./routes/api/courses"));
app.use("/conversations", require("./routes/api/conversations"));
app.use("/messages", require("./routes/api/messages"));
=======
app.use('/groups', require('./routes/api/groups'));
app.use('/users', require('./routes/api/users'));
app.use('/courses', require('./routes/api/courses'));
>>>>>>> 919e70bf5b970d0cf19bb85c0ef80c61d64ef78a

app.all("*", (req, res) => {
  res.status(404);
  if (req.accepts("html")) {
    res.sendFile(path.join(__dirname, "views", "404.html"));
  } else if (req.accepts("json")) {
    res.json({ error: "404 Not Found" });
  } else {
    res.type("txt").send("404 Not Found");
  }
});
app.use(errorHandler);

mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB");
  http.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
  });
});

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("search", async (query) => {
    console.log(query);
  });

  socket.on("load-messages", (data) => {
    // Load messages for the current conversation and user
    Message.find({
      conversation: data.conversation
    })
      .then((messages) => {
        socket.emit("load-messages", messages);
      })
      .catch((err) => {
        console.error(err);
      });
  });

  socket.on('create-conversation', (data) => {
    // Create a new conversation conversation
    const conversation = new Conversation({
      name: data.name,
      members: [data.creator]
    });
  
    conversation.save().then(() => {
      socket.emit('new-conversation', conversation);
    }).catch((err) => {
      console.error(err);
    });
  });

  socket.on('join-conversation', (data) => {
    // Join the user to the conversation
    socket.join(data.conversation);
  
    // Add the user to the conversation's user list
    Conversation.findOneAndUpdate({ _id: data.conversation }, { $addToSet: { users: data.userId } }).then(() => {
      // Broadcast a message to all users in the conversation
      socket.to(data.conversation).emit('user-joined', { userId: data.userId });
    }).catch((err) => {
      console.error(err);
    });
  });

  socket.on('leave-conversation', (data) => {
    // Remove the user from the conversation's user list
    Conversation.findOneAndUpdate({ _id: data.conversation }, { $pull: { users: data.userId } }).then(() => {
      // Broadcast a message to all users in the conversation
      socket.to(data.conversation).emit('user-left', { userId: data.userId });
    }).catch((err) => {
      console.error(err);
    });
  
    // Leave the user from the conversation
    socket.leave(data.conversation);
  });

  socket.on('load-conversations', () => {
    // Load the available conversation conversations
    Conversation.find().then((conversations) => {
      socket.emit('load-conversations', conversations);
    }).catch((err) => {
      console.error(err);
    });
  });

  socket.on("send-message", (data) => {
    // Save message to MongoDB
    const message = new Message({
      text: data.text,
      sender: data.sender,
      receiver: data.receiver,
      conversation: data.conversation,
    });

    message
      .save()
      .then(() => {
        // Broadcast message to all connected users
        socket.to(data.conversation).emit("new-message", message);
      })
      .catch((err) => {
        console.error(err);
      });
  });

  socket.on("receive-message", (data) => {
    // Find messages in MongoDB for this user
    Message.find({ receiver: data.receiver })
      .then((messages) => {
        // Send messages directly to this user
        socket.emit("messages", messages);
      })
      .catch((err) => {
        console.error(err);
      });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});
