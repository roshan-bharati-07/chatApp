import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import { Group } from "../model/group.model.js";
import { User } from "../model/user.model.js";

const createGroup = asyncHandler(async (req, res) => {
    const {
        grpName,
        adminId,
        members
    } = req.body

    if (!grpName || !adminId || !members || !Array.isArray(members) || members.length < 2) {
        throw new apiError(400, "Group name, admin and members are required")
    }

    // find admin userName
    const admin = await User.findById(adminId)

    if (!admin) {
        throw new apiError(404, "Admin not found")
    }

    const group = await Group.create({
        grpName,
        admin: [adminId],
        members
    })

    if (!group) {
        throw new apiError(500, "Failed to create group")
    }

    // short message
    const createMsg = `Group ${grpName} created by ${admin}`
    const dateTime = new Date()

    group.shortMsg.push({ content: createMsg, date: dateTime })
    await group.save()


    res.status(201).json(new apiResponse(201, "Group created successfully", group))
})

const addMembers = asyncHandler(async (req, res) => {

    const { groupId } = req.params
    const { members } = req.body

    if (!groupId || !members || !Array.isArray(members) || members.length < 1) {
        throw new apiError(400, "Group id and members are required")
    }

    const group = await Group.findById(groupId)

    if (!group) {
        throw new apiError(404, "Group not found")
    }

    group.members.push(...members)

    const updatedGroup = await group.save()

    if (!updatedGroup) {
        throw new apiError(500, "Failed to add members to group")
    }

    // array of username
    const userNames = await User.findById({ _id: { $in: members } }).select("username")

    // short message 
    const addMsg = `${userNames.map(user => user.username).join(", ")} has been added to the group`
    const dateTime = new Date()

    updatedGroup.shortMsg.push({ content: addMsg, date: dateTime })

    await updatedGroup.save()
    res.status(200).json(new apiResponse(200, "Members added to group successfully", updatedGroup))
})

const leaveGrp = asyncHandler(async (req, res) => {

    const {
        groupId,
        userId
    } = req.body

    if (!groupId || !userId) {
        throw new apiError(400, "Group id and user id are required")
    }

    const isGroupExisted = await Group.findById(groupId);
    if (!isGroupExisted) {
        throw new apiError()
    }
    const members = isGroupExisted.members

    if (!members.includes(userId)) {
        throw new apiError(400, "User is not a member of the group")
    }

    // remove the userId
    members.pull(groupId)

    const updatedGroup = await isGroupExisted.save()

    if (!updatedGroup) {
        throw new apiError(500, "Failed to leave group")
    }

    const user = await User.findById(userId)
    
    // short message 
    const leaveMsg = `${user.username} has left the group`
    const dateTime = new Date()

    updatedGroup.shortMsg.push({ content: leaveMsg, date: dateTime })
    await updatedGroup.save()

    res.status(200).json(new apiResponse(200, "Group left successfully", updatedGroup))

})
export { createGroup, addMembers, leaveGrp }
