import mongoose, { Schema } from "mongoose"
const messageSchema = new Schema({
    messageModel: {
        type: Schema.Types.ObjectId,
        ref: "MessageModel",
        required: true
    },
    category: {
        type: String,
        enum: ["user", "system"],
        default: "user",
        required: true
    },
    type: {
        type: String,
        enum: ["text", "image", "video", "file", "voiceMail", "video_call", "audio_call", "created_group", "added_to_group", "removed_from_group", "left_group", "left_group", "changed_group_name", "changed_group_avatar", "disappearing_messages_on", "disappearing_messages_off"],
        default: "text",
        required: true,
    },

    content: {
        type: String,
        required: true
    },

    editedContent: {
        type: String,
        required: function () {
            return this.isMessageEdited === true
        }
    },

    senderId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: function () {
            return this.category === "user"
        }
    },

    dateAndTime: {
        type: Date,    // frontend: new Date().toISOString()
        required: true
    },

    metaData: {
        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: function () {
                return this.category === "system"
            }
        },
        target: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: function () {
                return this.category === "system" && ["added_to_group", "removed_from_group"].includes(this.type)    // type is field, not target.type
            }
        },
    },

    reactions: {
        type: Map,
        of: {
            type: String,
            enum: ["like", "love", "laugh", "sad", "angry", "thumbs_up", "thumbs_down", "clap", "heart_eyes", "cry", "surprised"],
            required: true
        }
    },

    isMessageDeleted: {
        type: Boolean,
        default: false
    },

    isMessageReplied: {
        type: Boolean,
        default: false
    },

     replyTo: {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: function () {
                return this.isMessageReplied === true
            }
        },
        messageId: {
            type: Schema.Types.ObjectId,
            ref: "Message",
            required: function () {
                return this.isMessageReplied === true
            }
        }
     }  

});


export const Message = mongoose.model("Message", messageSchema)