import express from "express"

const router = express.Router()

import { 
    registerUser,
    turnOffReadReceipt,
    sentFriendReq,
    acceptFriendReq,
    deleteFriendReq,
    getFriendsAndRecentConversations,
    loginUser
} from "../controller/user.controller.js"

router.post("/register", registerUser)

router.post("/turn-off-read-receipt", turnOffReadReceipt)

router.post("/send-friend-req", sentFriendReq)
router.post("/accept-friend-req", acceptFriendReq)
router.delete("/delete-friend-req", deleteFriendReq)

router.get("/friends-conversations/:userId", getFriendsAndRecentConversations)

router.post("/login", loginUser)

export default router
