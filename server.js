import express from "express";
import http from "http";
import { Server } from "socket.io";

import { createAdapter } from "@socket.io/redis-adapter";
import { socketHandler } from "./src/utils/socketHandler.js";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./src/db/index.db.js";

// routes
import userRoute from "./src/routes/user.route.js";
import messageRoute from "./src/routes/message.route.js";
import groupRoute from "./src/routes/group.route.js";

// for testing 
import { Message } from "./src/model/message.model.js";
import { MessageModel } from "./src/model/messageModel.model.js";
import { User } from "./src/model/user.model.js";
import { pubClient, subClient, messageRedisClient } from "./src/utils/redis.js";

// middleware 
import errorMiddleware from "./src/middleware/apiError.middleware.js";
dotenv.config();

const app = express();
app.use(cors());

// MongoDB connection
connectDB();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

await Promise.all([
  pubClient.connect(),
  subClient.connect(),
  messageRedisClient.connect()
])

io.adapter(createAdapter(pubClient, subClient));

app.use(express.static("public"));
app.use(express.json());



app.use((req, res, next) => {
  req.io = io;
  next();
});

// API routes
app.use("/api/users", userRoute);
app.use("/api/messages", messageRoute);
app.use("/api/group", groupRoute);

// error middleware
app.use(errorMiddleware);

io.on("connection", (socket) => {
  socketHandler(socket, io);
});

app.get('/', async (req, res) => {
  const message = await Message.find()
  res.status(200).json(message)

})


app.get('/delete', async (req, res) => {
  const message = await Message.deleteMany();
  let count = message.deletedCount
  res.status(200).json(count)
})

//deleting messageCollection 
app.get('/delete/messageModel', async (req, res) => {
  const message = await MessageModel.deleteMany();
  let count = message.deletedCount
  res.status(200).json(count)
})

// get messageCollection 
app.get('/messageModel', async (req, res) => {
  const message = await MessageModel.find()
  res.status(200).json(message)
})

// users
app.get('/users/delete', async (req, res) => {
  const message = await User.deleteMany()
  const count = message.deletedCount
  res.status(200).json(count)
})

app.get('/users', async (req, res) => {
  const message = await User.find()
  res.status(200).json(message)
})


server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});