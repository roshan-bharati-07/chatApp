
import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import { User } from "../model/user.model.js";
import { MessageModel } from "../model/messageModel.model.js";
import { Message } from "../model/message.model.js";
import mongoose from "mongoose";
import { getSortedUsers } from "../utils/getSortedUsers.js";   // for private chat
import { messageRedisClient } from "../utils/redis.js";
import { ReadConversation } from "../model/readConversation.model.js";
// import { uploadOnCloudinary } from "../utils/cloudinary.js";

const sendPrivateMsg = asyncHandler(async (req, res) => {

    const session = await mongoose.startSession()
    let createdMessage;
    let roomId;

    try {
        const { receiverId, type, dateAndTime, senderId, isGroup } = req.body
        let { content } = req.body
        const file = req?.file
        const io = req.io

        if (isGroup) {
            throw new apiError(400, "For group messages, use the /sendGroupMsg endpoint")
        }

        if (!senderId || !receiverId || !content || !type || !dateAndTime) {
            throw new apiError(400, "senderId, receiverId, type, dateAndTime and content are required")
        }

        const userA = await User.findById(senderId)
        const userB = await User.findById(receiverId)

        if (!userA || !userB) {
            throw new apiError(404, "Sender or receiver not found")
        }


        let originalSender, originalMessage;

        if (req.body?.isMessageReplied) {
            const { replyTo } = req.body
            if (!replyTo?.senderId || !replyTo?.messageId) {
                throw new apiError(400, "replyTo (senderId and messageId) are required when isMessageReplied is true")
            }
            originalSender = await User.findById(replyTo.senderId)
            originalMessage = await Message.findById(replyTo.messageId)

            if (!originalSender || !originalMessage) {
                throw new apiError(404, "Reply sender or message not found")
            }
        }


        if (file?.path) {
            // const uploadedFile = await uploadOnCloudinary(file.path)
            content = uploadedFile.secure_url
        }

        const sortedUsers = getSortedUsers(senderId, receiverId)
        const userIds = sortedUsers.map(id => new mongoose.Types.ObjectId(id))

        await session.withTransaction(async () => {
            let conversation = await MessageModel.findOne({
                isGroup: false,
                participants: { $all: userIds, $size: 2 }
            }).session(session)

            if (!conversation) {
                const [newConversation] = await MessageModel.create([{
                    participants: sortedUsers,
                    isGroup: false,
                    lastMessageSeen: {}
                }], { session })
                conversation = newConversation
            }


            roomId = conversation._id

            const [message] = await Message.create([{
                messageModel: conversation._id,
                senderId,
                type,
                content,
                dateAndTime,
                category: "user",
                replyTo: req.body?.isMessageReplied ? {
                    senderId: originalSender._id,
                    messageId: originalMessage._id
                } : undefined

            }], { session })

            createdMessage = message

            conversation.updatedAt = new Date()

            if (!userA.readReceiptOff || !userB.readReceiptOff) {
                conversation.lastMessageSeen.set(senderId.toString(), message._id)
            }

            await conversation.save({ session })
        })


        if (createdMessage) {
            io.to(roomId.toString()).emit('receive:private:message', createdMessage)
        }

        res.status(200).json(new apiResponse(200, "Message sent successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to send message", error)
    } finally {
        session.endSession()
    }
})

const sendGroupMsg = asyncHandler(async (req, res) => {

    const session = await mongoose.startSession()
    let createdMessage;

    try {
        const { groupId, type, dateAndTime, senderId, isGroup } = req.body
        let { content } = req.body
        const file = req?.file
        const io = req.io

        if (!groupId || !content || !senderId || !type || !dateAndTime || !isGroup) {
            throw new apiError(400, "groupId, content, senderId, type, dateAndTime and isGroup are required")
        }

        const user = await User.findById(senderId)

        if (!user) {
            throw new apiError(404, "Sender not found")
        }

        const conversation = await MessageModel.findById(groupId)

        if (!conversation || !conversation.isGroup) {
            throw new apiError(404, "Group not found")
        }


        const isMember = conversation.participants.some(
            p => p.toString() === senderId.toString()
        )
        if (!isMember) {
            throw new apiError(403, "You are not a member of this group")
        }

        let originalSender, originalMessage;

        if (req.body?.isMessageReplied) {
            const { replyTo } = req.body
            if (!replyTo?.senderId || !replyTo?.messageId) {
                throw new apiError(400, "replyTo (senderId and messageId) are required when isMessageReplied is true")
            }
            originalSender = await User.findById(replyTo.senderId)
            originalMessage = await Message.findById(replyTo.messageId)

            if (!originalSender || !originalMessage) {
                throw new apiError(404, "Reply sender or message not found")
            }
        }


        if (file?.path) {
            // const uploadedFile = await uploadOnCloudinary(file.path)
            content = uploadedFile.secure_url
        }


        await session.withTransaction(async () => {

            const [message] = await Message.create([{
                messageModel: conversation._id,
                senderId,
                type,
                content,
                dateAndTime,
                category: "user",
                replyTo: req.body?.isMessageReplied ? {
                    senderId: originalSender._id,
                    messageId: originalMessage._id
                } : undefined
            }], { session })

            createdMessage = message
            conversation.updatedAt = new Date()

            if (!user.readReceiptOff) {
                conversation.lastMessageSeen.set(senderId.toString(), message._id)
            }

            await conversation.save({ session })
        })

        try {
            if (createdMessage) {
                io.to(groupId.toString()).emit('receive:group:message', createdMessage)
            }
        } catch (error) {
            throw new apiError(500, "Failed to emit group message via socket", error)
        }

        return res.status(200).json(new apiResponse(200, "Group message sent successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to send group message", error)
    } finally {
        session.endSession()
    }
})


const getPrivateMsg = asyncHandler(async (req, res) => {

    const { conversationId } = req?.params;

    if (!conversationId) {
        throw new apiError(400, "conversationId is required")
    }


    const CACHE_KEY = `chat:${conversationId}:messages`;
    const CACHE_TTL = 60 * 60;

    const cached = await messageRedisClient.lRange(CACHE_KEY, 0, 9);

    if (cached && cached.length > 0) {
        const messages = cached.map(msg => JSON.parse(msg));
        return res
            .status(200)
            .json(new apiResponse(200, "Messages retrieved successfully (cache)", messages, true));
    }


    const conversation = await MessageModel.findById(conversationId)
        .select("participants lastMessageSeen")
        .populate("participants", "username avatar")
        .lean()

    if (!conversation) {
        return res
            .status(404)
            .json(new apiResponse(404, "Conversation not found", {}, false));
    }

    const messages = await Message.find({ messageModel: conversationId })
        .sort({ dateAndTime: -1 })
        .limit(10)
        .populate("senderId", "username avatar")
        .lean()


    if (messages && messages.length > 0) {
        const pipeline = messageRedisClient.multi();
        pipeline.del(CACHE_KEY);
        for (const msg of messages) {
            pipeline.rPush(CACHE_KEY, JSON.stringify(msg));
        }
        pipeline.expire(CACHE_KEY, CACHE_TTL);
        await pipeline.exec();
    }

    return res
        .status(200)
        .json(new apiResponse(200, "Messages retrieved successfully", { conversation, messages }, true))
})


const getGroupMessage = asyncHandler(async (req, res) => {

    const { groupId } = req?.params

    if (!groupId) {
        throw new apiError(400, "groupId is required")
    }

    const CACHE_KEY = `chat:${groupId}:messages`;
    const CACHE_TTL = 60 * 60;

    const cached = await messageRedisClient.lRange(CACHE_KEY, 0, 9);

    if (cached && cached.length > 0) {
        const messages = cached.map(msg => JSON.parse(msg));
        return res
            .status(200)
            .json(new apiResponse(200, "Messages retrieved successfully (cache)", messages, true));
    }

    const conversation = await MessageModel.findOne({ _id: groupId, isGroup: true })
        .select("participants adminId groupName groupAvatar lastMessageSeen")
        .populate("participants", "username avatar")
        .lean()

    if (!conversation) {
        return res
            .status(404)
            .json(new apiResponse(404, "Group not found", {}, false));
    }

    const messages = await Message.find({ messageModel: groupId })
        .sort({ dateAndTime: -1 })
        .limit(10)
        .populate("senderId", "username avatar")
        .lean()

    if (messages && messages.length > 0) {
        const pipeline = messageRedisClient.multi();
        pipeline.del(CACHE_KEY);
        for (const msg of messages) {
            pipeline.rPush(CACHE_KEY, JSON.stringify(msg));
        }
        pipeline.expire(CACHE_KEY, CACHE_TTL);
        await pipeline.exec();
    }

    //unread message

    const readConversation = await ReadConversation.findOne({
        $and: [
            { userId: req.user._id },
            { conversationId: groupId }
        ]
    }).select("lastReadAt")


    return res
        .status(200)
        .json(new apiResponse(200, "Messages retrieved successfully", {
            conversation,
            messages,
            lastReadAt: readConversation?.lastReadAt || new Date(0)
        }, true))
})

const deleteMessage = asyncHandler(async (req, res) => {

    const { messageId } = req?.params
    const io = req.io

    if (!messageId) {
        throw new apiError(400, "messageId is required")
    }

    const message = await Message.findById(messageId);

    if (!message) {
        throw new apiError(404, "Message not found")
    }

    if (message.isMessageDeleted || message.content === null || message.type != "text" || message.category != "user" || message.senderId.toString() !== req.user._id.toString()) {
        throw new apiError(400, "Message cannot be edited")
    }

    message.isMessageDeleted = true;
    message.content = null;
    message.type = "text";

    const updatedMessage = await message.save();

    if (!updatedMessage) {
        throw new apiError(500, "Failed to delete message")
    }

    // io emit 
    try {
        io.to(updatedMessage.messageModel.toString()).emit('message:deleted', { messageId: messageId, content: null })
    } catch (error) {
        throw new apiError(500, "Failed to emit message deletion via socket", error)
    }

    return res.status(200).json(new apiResponse(200, "Message deleted successfully", {}, true))
})

const editMessage = asyncHandler(async (req, res) => {

    const { originalMessageId } = req?.params
    const { editContent } = req?.body7
    const io = req.io

    if (!originalMessageId || !editContent) {
        throw new apiError(400, "originalMessageId and editContent are required")
    }

    const message = await Message.findById(originalMessageId);

    if (!message) {
        throw new apiError(404, "Message not found")
    }

    if (message.isMessageDeleted || message.content === null || message.type != "text" || message.category != "user" || message.senderId.toString() !== req.user._id.toString()) {
        throw new apiError(400, "Message cannot be edited")
    }


    message.content = editContent;

    const updatedMessage = await message.save();

    if (!updatedMessage) {
        throw new apiError(500, "Failed to edit message")
    }

    try {
        io.to(updatedMessage.messageModel.toString()).emit('message:edited', { messageId: originalMessageId, content: editContent })
    } catch (error) {
        throw new apiError(500, "Failed to edit message")
    }

    return res.status(200).json(new apiResponse(200, "Message edited successfully", {}, true))
})




export {
    sendPrivateMsg,
    sendGroupMsg,
    getPrivateMsg,
    getGroupMessage,
    deleteMessage,
    editMessage
}