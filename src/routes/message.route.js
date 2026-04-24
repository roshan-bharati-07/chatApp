import express from "express"
const router = express.Router()
import { 
    sendPrivateMsg, 
    sendGroupMsg, 
    getPrivateMsg,
    getGroupMessage,
    deleteMessage,
    editMessage
} from "../controller/message.controller.js"

// Send messages
router.post("/send", sendPrivateMsg)
router.post("/group", sendGroupMsg)

// Get messages
router.get("/get/:conversationId", getPrivateMsg)
router.get("/group/:groupId", getGroupMessage)

// Delete message
router.delete("/:messageId", deleteMessage)

// Edit message
router.put("/edit/:messageId", editMessage)

export default router