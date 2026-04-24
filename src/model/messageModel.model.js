import mongoose, { Schema } from "mongoose"

const messageModelSchema = new Schema({

// if isGroup => participants = group members 
    participants: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],

    isGroup: {
        type: Boolean,
        required: true,
        default: false
    },

    // group related field 
    groupName: {
        type: String,
        required: function () {
            return this.isGroup === true
        }
    },

    adminId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: function () {
            return this.isGroup === true
        }
    },

    groupAvatar: {
        type: String,
        default: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        required: function () {
            return this.isGroup === true
        }
    },
    
    lastMessageSeen: {
        type:Map,
        of:Schema.Types.ObjectId,    
    }

}, {
    timestamps: true
})

// if isGroup => messageModel._id = groupId 
export const MessageModel = mongoose.model("MessageModel", messageModelSchema)