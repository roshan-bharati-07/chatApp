import mongoose, { Schema } from "mongoose"

const FriendSchema = new Schema({
  users: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User', index: true
    }
  ],
  status: {  // factor
    type: String,
    enum: ['pending', 'accepted']
  }, 

  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
}, {
  timestamps: true
});


export const Friend = mongoose.model("Friend", FriendSchema);