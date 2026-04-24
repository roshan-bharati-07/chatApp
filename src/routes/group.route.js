import express from "express";
const router = express.Router();

import { 
    createGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    leaveGroup,
    changeGroupName,
    deleteGroup
} from "../controller/system.controller.js";

router.post("/create", createGroup)

router.post("/:groupId/add-member", addMemberToGroup)

router.post("/:groupId/remove-member", removeMemberFromGroup)

router.post("/:groupId/leave", leaveGroup)

router.put("/:groupId/name", changeGroupName)

router.delete("/:groupId", deleteGroup)

export default router
