
import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import { Message } from "../model/message.model.js";
import { MessageModel } from "../model/messageModel.model.js";
import { User } from "../model/user.model.js";
import mongoose from "mongoose";

const sendSystemMessage = async ({ messageModelId, type, actorId, targetId = null, content, session }) => {

    const validSystemTypes = [
        "created_group",
        "added_to_group",
        "removed_from_group",
        "left_group",
        "changed_group_name",
        "changed_group_avatar",
        "disappearing_messages_on",
        "disappearing_messages_off"
    ]

    if (!validSystemTypes.includes(type)) {
        throw new apiError(400, `Invalid system message type: ${type}`)
    }

    // target is required for added_to_group and removed_from_group
    if (["added_to_group", "removed_from_group"].includes(type) && !targetId) {
        throw new apiError(400, `targetId is required for type: ${type}`)
    }

    const messageData = {
        messageModel: messageModelId,
        category: "system",
        type,
        content,
        dateAndTime: new Date(),
        metaData: {
            actor: actorId,
            ...(targetId ? { target: targetId } : {})
        }
    }

    const [message] = await Message.create([messageData], { session })

    return message
}



// create group
const createGroup = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession()

    try {
        const { groupName, adminId, participants } = req.body

        if (!groupName || !adminId || !participants?.length) {
            throw new apiError(400, "groupName, adminId and participants are required")
        }

        let createdMessage;

        await session.withTransaction(async () => {

            const [conversation] = await MessageModel.create([{
                participants: [...participants, adminId],
                isGroup: true,
                groupName,
                adminId,
                lastMessageSeen: {}
            }], { session })

            createdMessage = await sendSystemMessage({
                messageModelId: conversation._id,
                type: "created_group",
                actorId: adminId,
                content: `${groupName} group created`,
                session
            })
        })

        return res
            .status(201)
            .json(new apiResponse(201, "Group created successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to create group", error)
    } finally {
        session.endSession()
    }
})


// add member
const addMemberToGroup = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession()

    try {
        const { groupId } = req.params
        const { actorId, targetId } = req.body

        if (!groupId || !actorId || !targetId) {
            throw new apiError(400, "groupId, actorId and targetId are required")
        }

        let createdMessage;

        await session.withTransaction(async () => {

            const conversation = await MessageModel.findOne({ _id: groupId, isGroup: true }).session(session)

            if (!conversation) {
                throw new apiError(404, "Group not found")
            }

            if (conversation.adminId.toString() !== actorId.toString()) {
                throw new apiError(403, "Only admin can add members")
            }

            const alreadyMember = conversation.participants.some(
                p => p.toString() === targetId.toString()
            )
            if (alreadyMember) {
                throw new apiError(400, "User is already a member")
            }

            conversation.participants.push(targetId)
            await conversation.save({ session })

            createdMessage = await sendSystemMessage({
                messageModelId: conversation._id,
                type: "added_to_group",
                actorId,
                targetId,
                content: "added to the group",
                session
            })
        })

        return res
            .status(200)
            .json(new apiResponse(200, "Member added successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to add member", error)
    } finally {
        session.endSession()
    }
})


// remove member
const removeMemberFromGroup = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession()

    try {
        const { groupId } = req.params
        const { actorId, targetId } = req.body

        if (!groupId || !actorId || !targetId) {
            throw new apiError(400, "groupId, actorId and targetId are required")
        }

        let createdMessage;

        await session.withTransaction(async () => {

            const conversation = await MessageModel.findOne({ _id: groupId, isGroup: true }).session(session)

            if (!conversation) {
                throw new apiError(404, "Group not found")
            }

            if (conversation.adminId.toString() !== actorId.toString()) {
                throw new apiError(403, "Only admin can remove members")
            }

            conversation.participants = conversation.participants.filter(
                p => p.toString() !== targetId.toString()
            )
            await conversation.save({ session })

            createdMessage = await sendSystemMessage({
                messageModelId: conversation._id,
                type: "removed_from_group",
                actorId,
                targetId,
                content: "removed from the group",
                session
            })
        })

        return res
            .status(200)
            .json(new apiResponse(200, "Member removed successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to remove member", error)
    } finally {
        session.endSession()
    }
})


// leave group
const leaveGroup = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession()

    try {
        const { groupId } = req.params
        const { actorId } = req.body

        if (!groupId || !actorId) {
            throw new apiError(400, "groupId and actorId are required")
        }

        let createdMessage;

        await session.withTransaction(async () => {

            const conversation = await MessageModel.findOne({ _id: groupId, isGroup: true }).session(session)

            if (!conversation) {
                throw new apiError(404, "Group not found")
            }

            const isMember = conversation.participants.some(
                p => p.toString() === actorId.toString()
            )
            if (!isMember) {
                throw new apiError(400, "You are not a member of this group")
            }

            if (conversation.adminId.toString() === actorId.toString()) {
                throw new apiError(400, "Admin cannot leave the group, transfer admin first")
            }

            conversation.participants = conversation.participants.filter(
                p => p.toString() !== actorId.toString()
            )
            await conversation.save({ session })

            createdMessage = await sendSystemMessage({
                messageModelId: conversation._id,
                type: "left_group",
                actorId,
                content: "left the group",
                session
            })
        })

        return res
            .status(200)
            .json(new apiResponse(200, "Left group successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to leave group", error)
    } finally {
        session.endSession()
    }
})

// change group name 
const changeGroupName = asyncHandler(async (req, res) => {

    const session = await mongoose.startSession()

    try {
        const { groupId } = req.params
        const { actorId, newGroupName } = req.body

        if (!groupId || !actorId || !newGroupName) {
            throw new apiError(400, "groupId, actorId and newGroupName are required")
        }

        let createdMessage;

        await session.withTransaction(async () => {

            const conversation = await MessageModel.findOne({ _id: groupId, isGroup: true }).session(session)

            if (!conversation) {
                throw new apiError(404, "Group not found")
            }

            if (conversation.adminId.toString() !== actorId.toString()) {
                throw new apiError(403, "Only admin can change group name")
            }

            conversation.grpName = newGroupName
            await conversation.save({ session })

            createdMessage = await sendSystemMessage({
                messageModelId: conversation._id,
                type: "changed_group_name",
                actorId,
                content: `changed group name to ${newGroupName}`,
                session
            })
        })

        return res
            .status(200)
            .json(new apiResponse(200, "Group name changed successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to change group name", error)
    } finally {
        session.endSession()
    }
})


// delete group 
const deleteGroup = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession()
    try {
        const { groupId } = req.params
        const { actorId } = req.body

        if (!groupId || !actorId) {
            throw new apiError(400, "groupId and actorId are required")
        }

        let createdMessage;

        await session.withTransaction(async () => {

            const conversation = await MessageModel.findOne({ _id: groupId, isGroup: true }).session(session)

            if (!conversation) {
                throw new apiError(404, "Group not found")
            }

            if (conversation.adminId.toString() !== actorId.toString()) {
                throw new apiError(403, "Only admin can delete the group")
            }

            await MessageModel.findByIdAndDelete(groupId, { session })
            createdMessage = await sendSystemMessage({
                messageModelId: conversation._id,
                type: "deleted_group",
                actorId,
                content: "deleted the group",
                session
            })
        })

        return res
            .status(200)
            .json(new apiResponse(200, "Group deleted successfully", createdMessage, true))

    } catch (error) {
        if (error instanceof apiError) throw error
        throw new apiError(500, "Failed to delete group", error)
    } finally {
        session.endSession()        
    }
    })

    export {
    createGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    leaveGroup,
    changeGroupName,
    deleteGroup
    }