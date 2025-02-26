import mongoose from "mongoose";
import moment from "moment-timezone";

const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: {
    type: Date,
    default: () => moment().tz("Asia/Kolkata").toDate(),
    immutable: true,
  },
  updatedAt: {
    type: Date,
  },
  versions: [
    {
      title: { type: String, required: true },
      content: { type: String, required: true },
      createdAt: {
        type: Date,
      }
    },
  ]
}, { timestamps: false });

const Blog = mongoose.model("Blog", BlogSchema);
export default Blog;
