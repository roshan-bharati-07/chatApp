import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import { User } from "../model/user.model.js";
import { Message } from "../model/message.model.js";
import { MessageModel } from "../model/messageModel.model.js";
import mongoose, { Mongoose } from "mongoose";
import { getSortedUsers } from "../utils/getSortedUsers.js";
import { Friend } from "../model/friend.model.js";


const registerUser = asyncHandler(async (req, res) => {

    const { username, password } = req.body

    if (!username || !password) {
        throw new apiError(400, "Username and password are required")
    }

    const isUserExisted = await User.findOne({ username: username })

    if (isUserExisted) {
        throw new apiError(400, "User already exists")
    }

    const user = await User.create({
        username,
        password
    })
        .catch((err) => {
            throw new apiError(400, "Failed to create user")
        })

    // we can use try/catch here, but trycatch is not recommended inside asyncHandler 
    // reason => asyncHandler passes error to next() automatically 
    // code readability and less bioler-plate 


    //even if creatin failed =>mongoose sent error message =>!user doesn't work =>!user works with falsy value 

    const createdUser = await User.findById(user._id).select("-password")

    if (!createdUser) {
        throw new apiError(400, "Failed to create user")
    }


    return res.status(201).json(new apiResponse(201, "User created successfully", createdUser, true))
})


const loginUser = asyncHandler(async (req, res) => {

    const { username, password } = req.body

    if (!username || !password) {
        throw new apiError(400, "Username and password are required")
    }

    const user = await User.findOne({ username: username }).select("-password")

    if (!user) {
        throw new apiError(404, "User not found")
    }

    if (user.password !== password) {
        throw new apiError(401, "Incorrect password")
    }


    return res.status(200).json(new apiResponse(200, "User logged in successfully", {
        user
    }, true))
})

const turnOffReadReceipt = asyncHandler(async (req, res) => {
    const {
        userId
    } = req.body;

    if (!userId) {
        throw new apiError(400, "User id is required")
    }

    const user = await User.findByIdAndUpdate(userId, {
        readReceiptOff: true
    })

    if (!user) {
        throw new apiError(404, "User not found || failed to update")
    }

    return res.status(200).json(new apiResponse(200, "Read receipt turned off successfully", {}, true))

})

// userA = actor and userB = target
const sentFriendReq = asyncHandler(async (req, res) => {
    const {
        userA,
        userB
    } = req.body;

    if (!userA || !userB) {
        throw new apiError(400, "User ids are required")
    }

    const sortedUser = getSortedUsers(userA, userB);
    // add mongoose types object id
    const sortedUserIds = sortedUser.map(id => new mongoose.Types.ObjectId(id));

    const existingFriendReq = await Friend.findOne({
        users: { $all: sortedUserIds }
    })

    if (existingFriendReq) {
        throw new apiError(400, "Friend request already sent")
    }

    const friendReq = await Friend.create({
        users: sortedUser,
        status: "pending",
        requestedBy: userA
    })

    if (!friendReq) {
        throw new apiError(500, "Failed to send friend request")
    }

    // io
    const io = req.io
    io.to(userB).emit("friend:request", {
        senderId: userA
    })

    return res.status(201).json(new apiResponse(201, "Friend request sent successfully", {}, 201))

})


const acceptFriendReq = asyncHandler(async (req, res) => {
    const {
        actorId,
        targetId
    } = req.body;

    if (!actorId || !targetId) {
        throw new apiError(400, "User ids are required")
    }

    const sortedUser = getSortedUsers(actorId, targetId);
    const sortedUserIds = sortedUser.map(id => new mongoose.Types.ObjectId(id));

    const existingFriendReq = await Friend.findOne({

        $and: [
            { users: { $all: sortedUserIds } },    // { users: { $all: [actorId, targetId] } }
            { status: "pending" },
            { requestedBy: targetId }             // userB le friend request pathako hunu paryo
        ]

    })

    if (!existingFriendReq) {
        throw new apiError(400, "Friend request not found")
    }

    if (existingFriendReq.status !== "pending") {
        throw new apiError(400, "Friend request already accepted")
    }

    existingFriendReq.status = "accepted"
    const updatedFriendReq = await existingFriendReq.save()

    if (!updatedFriendReq) {
        throw new apiError(500, "Failed to accept friend request")
    }

    return res.status(200).json(new apiResponse(200, "Friend request accepted successfully", updatedFriendReq, true))
})

// userA = actor and userB = target
const deleteFriendReq = asyncHandler(async (req, res) => {
    const {
        userA,
        userB
    } = req.body;

    if (!userA || !userB) {
        throw new apiError(400, "User ids are required")
    }

    const sortedUser = getSortedUsers(userA, userB);
    const sortedUserIds = sortedUser.map(id => new mongoose.Types.ObjectId(id));

    const existingFriendReq = await Friend.findOne({
        users: { $all: sortedUserIds }
    })

    if (!existingFriendReq) {
        throw new apiError(400, "Friend request not found")
    }

    const deletedFriendReq = await Friend.findByIdAndDelete(existingFriendReq._id)

    if (!deletedFriendReq) {
        throw new apiError(500, "Failed to delete friend request")
    }

    return res.status(200).json(new apiResponse(200, "Friend request deleted successfully", deletedFriendReq, true))
})

const fetchFriendList = asyncHandler(async (req, res) => {   // profile

    const { userId } = req.params;

    if (!userId) {
        throw new apiError(400, "User id is required")
    }

    // aggregation pipleine 

    const friend = await Friend.aggregate([
        {
            $match: {
                $and: [
                    { users: { $in: new mongoose.Types.ObjectId(userId) } },
                    { status: "accepted" }
                ]
            }
        }, { $sort: { updatedAt: -1 } }, { $limit: 10 },
        {
            $project: {
                // to fiter actor userId
                $friendsId: {                  // creating temporary field
                    $cond: [                 // similar to if else 
                        { $eq: ["$users.0", userId] },     // condition
                        "$users.1",                     // if true 
                        "$users.0"                     // if false 
                        // users = array of user from $match  
                        // $users.0 = users[0]
                        // value added to $friendsId
                    ]
                }
            }
        }, {
            $lookup: {
                from: "users",
                localField: "$friendsId",         // users id saved in $friendsId 
                foreignField: "_id",
                as: "friend"
            }
        }, {
            $unwind: "$friend"               // convert array to object 
        },

    ])

    return res.status(200).json(new apiResponse(200, "Friend list fetched successfully", friendList, true))
})

const getRecentConversations = asyncHandler(async (req, res) => {

    const { userId } = req.params;
    const { converation_updatedAt } = req?.query;

    if (!userId) {
        throw new apiError(400, "userId is required")
    }

    const conversation = await MessageModel.aggregate([
        {
            $match: {
                participants: new mongoose.Types.ObjectId(userId),
                ...(conversation_updatedAt && {
                    $expr: {
                        $lt: ["$updatedAt", { $toDate: conversation_updatedAt }]
                    }
                })
            },
        },
        { $sort: { updatedAt: -1 } }, { $limit: 15 },    // for conversations 


        {
            $lookup: {
                from: "messages",        // for messages
                let: { conversationId: "$_id" },  // messageModel id
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$messageModel", "$$conversationId"],
                            }
                        },
                    },
                    {
                        $sort: {
                            dateAndTime: -1
                        }
                    },
                    {
                        $limit: 1
                    }
                ],
                as: "lastMessageConversation"
            }
        },
        {
            $addFields: {
                lastMessage: {
                    $ifNull: [
                        { $arrayElemAt: ['$lastMessageConversation', 0] },
                        null
                    ]
                }
            }
        },

        {
            $lookup: {
                from: "readconversations",
                let: { conversationId: "$_id" },

                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [    // both needs to tru
                                    { $eq: ["$conversationId", "$$conversationId"] },
                                    { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }
                                ],
                            }
                        }
                    }
                ],
                as: "readRecord"
            }
        },
        {
            $addFields: {
                readRecord: { $arrayElemAt: ['$readRecord', 0] }
            }
        },

        {
            $lookup: {
                from: "messages",
                let: { conversationId: "$_id", lastSeenAt: '$readRecord.lastReadAt' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$messageModel", "$$conversationId"] },
                                    { $gte: ["$dateAndTime", "$$lastSeenAt"] },
                                    { $ne: ["$senderId", new mongoose.Types.ObjectId(userId)] }
                                ]
                            }
                        }
                    }, {
                        $count: "unreadCount"
                    }
                ],
                as: "unreadMessages"
            }
        },
        {
            $addFields: {
                unreadCount: { $ifNull: [{ $arrayElemAt: ['$unreadMessages.unread', 0] }, 0] }
            }
        },
        {
            $project: {
                readRecord: 0,
                unreadMessages: 0,
            }
        }
    ])

    return res.status(200).json(new apiResponse(200, "Recent conversations fetched successfully", conversation, true))
})

const markAsRead = asyncHandler(async (req, res) => {
    const { userId, conversationId, messageId } = req.body
    const io = req.io

    if (!userId || !conversationId || !messageId) {
        throw new apiError(400, "User id, conversation id, and message id are required")
    }

    const user = await User.findById(userId)

    if (!user) {
        throw new apiError(404, "User not found")
    }

    const conversation = await MessageModel.findById(conversationId)

    if (!conversation) {
        throw new apiError(404, "Conversation not found")
    }

    const message = await Message.findById(messageId)

    if (!message) {
        throw new apiError(404, "Message not found")
    }

    // for user to track unread message
    const readConversation = await ReadConversation.findOneAndUpdate({
        $and: [
            { userId: userId },
            { conversationId: conversationId }
        ]
    }, {
        lastReadAt: new Date()
    }, {
        upsert: true,
        new: true
    })

    if (!readConversation) {
        throw new apiError(500, "Failed to mark conversation as seen")
    }

    if (!message.senderId.toString() === userId || !user.readReceiptOff) {
        // update in message model lastMessage Seen
        const fieldPath = `lastMessageSeen.${userId}`;

        // Update the message model (or Conversation model)
        const updatedConversation = await MessageModel.findOneAndUpdate(
            { _id: conversationId },
            { $set: { [fieldPath]: messageId } },
            { upsert: true }
        );

        if (!updatedConversation) {
            throw new apiError(500, "Failed to update conversation with last message seen")
        }

        try {
            io.to(conversationId).emit("message:seen", {
                conversationId,
                messageId,  // last message id
                userId
            })
        } catch (error) {
            throw new apiError(500, "Failed to emit message seen event")
        }

    }

    return res.status(200).json(new apiResponse(200, "Conversation marked as read successfully", {}, true))
})


const getFriendsAndRecentConversations = asyncHandler(async (req, res) => {
    const {
        userId
    } = req.body

    if (!userId) {
        throw new apiError(400, "User id is required")
    }

    const user = await User.findById(userId)

    if (!user) {
        throw new apiError(404, "User not found")
    }


    const friendAndMessage = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $facet: {
                friends: [        //pipeline #output: {friends:[results]} 
                    {
                        $lookup: {
                            from: "friends",

                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $match: { $expr: { $in: ["$_id", "$users"] } } },
                                                { $eq: ["$status", "accepted"] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "friendRecord"
                        }
                    }, {
                        $project: {
                            // temporary field
                            friendId: {
                                $cond: [
                                    { $eq: ["$friendRecord.users.0", "$_id"] },
                                    "$friendRecord.users.1",
                                    "$friendRecord.users.0"
                                ]
                            }

                        }
                    }, {
                        $lookup: {
                            from: "users",
                            localField: "$friendId",
                            foreignField: "_id",
                            as: "friend"
                        }
                    }, {
                        $unwind: "$friend"
                    }
                ],
                recentConversation: [
                    {
                        $lookup: {
                            from: "messagemodels",
                            let: {
                                userId: "$_id"
                            },
                            pipeline: [{
                                $match: {
                                    $expr: {
                                        $eq: ["$participants", "$$userId"]
                                    }
                                }
                            }, {
                                $sort: {
                                    updatedAt: -1
                                }
                            }, {
                                $limit: 10
                            }

                            ],
                            as: "conversation"
                        }
                    },
                    {
                        $unwind: "$conversation"
                    }, {
                        $lookup: {
                            from: "messages",
                            let: {
                                conversationId: "$conversation._id",
                                userId: "$_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr:
                                            { $eq: ["$conversationId", "$$conversationId"] },
                                    }
                                },
                                { $sort: { createdAt: -1 } },
                                { $limit: 1 }
                            ],
                            as: "lastMessage"
                        }
                    },

                    { $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },    // if no message, lastMessage = null

                    {

                    }
                ],


            }
        }
    ])
})


export {
    registerUser,
    turnOffReadReceipt,
    sentFriendReq,
    acceptFriendReq,
    deleteFriendReq,
    fetchFriendList,
    getRecentConversations,
    loginUser
}