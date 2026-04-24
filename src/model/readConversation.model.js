import mongoose, {Schema} from "mongoose"
const readConversationSchema = new Schema({

    conversationId: {   
        type: Schema.Types.ObjectId,
        ref: "MessageModel",
        required: true
    },

    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    lastReadAt: {
        type: Date,  
        required: true
    }

})

export const ReadConversation = mongoose.model("ReadConversation", readConversationSchema)