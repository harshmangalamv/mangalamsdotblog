import mongoose from "mongoose";
import moment from "moment-timezone";

const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: moment().tz("Asia/Kolkata").format() }, // Stores IST time
});

const Blog = mongoose.model("Blog", BlogSchema);
export default Blog;
