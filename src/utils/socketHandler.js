import { Message } from "../model/message.model.js";
import { MessageModel } from "../model/messageModel.model.js";
import { User } from "../model/user.model.js";

const socketHandler = (socket, io) => {

  socket.on("private:join", ({ conversationId }) => {
    if (!conversationId) return
    socket.join(conversationId)
  })

  socket.on("private:leave", ({ conversationId }) => {
    if (!conversationId) return
    socket.leave(conversationId)
  })

  socket.on("private:seen", ({ conversationId, userId, messageId }) => {
    if (!conversationId || !userId || !messageId) return
    io.to(conversationId).emit("private:seen:update", { messageId, seenBy: userId })
  })

  socket.on("private:typing", ({ conversationId, userId }) => {
    if (!conversationId || !userId) return
    io.to(conversationId).emit("private:typing:update", { userId })
  })

  socket.on("private:stop:typing", ({ conversationId, userId }) => {
    if (!conversationId || !userId) return
    io.to(conversationId).emit("private:stop:typing:update", { userId })
  })


  socket.on("group:join", ({ groupId }) => {
    if (!groupId) return
    socket.join(groupId)
  })

  socket.on("group:leave", ({ groupId }) => {
    if (!groupId) return
    socket.leave(groupId)
  })

  socket.on("group:seen", ({ groupId, userId, messageId }) => {
    if (!groupId || !userId || !messageId) return
    io.to(groupId).emit("group:seen:update", { messageId, seenBy: userId })
  })

  socket.on("group:typing", ({ groupId, userId }) => {
    if (!groupId || !userId) return
    io.to(groupId).emit("group:typing:update", { userId })
  })

  socket.on("group:stop:typing", ({ groupId, userId }) => {
    if (!groupId || !userId) return
    io.to(groupId).emit("group:stop:typing:update", { userId })
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
  })

}

export { socketHandler }