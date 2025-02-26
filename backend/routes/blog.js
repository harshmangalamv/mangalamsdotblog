import express from "express";
import Blog from "../models/Blog.js";
import authMiddleware from "../middleware/authMiddleware.js";
import moment from "moment-timezone";

const router = express.Router();

// Create a Blog (Protected)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const newBlog = new Blog({ title, content, author: req.user.id });
    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get All Blogs
router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find().populate("author", "username");
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get Single Blog by ID
router.get("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate("author", "username");
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Update Blog (Protected)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.author.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    blog.versions.push({
      title: blog.title,
      content: blog.content,
      createdAt: blog.updatedAt,
    },)
    console.log(blog);

    blog.markModified("versions"); // Tell Mongoose that versions array changed

    blog.title = req.body.title || blog.title;
    blog.content = req.body.content || blog.content;
    blog.updatedAt = moment().tz("Asia/Kolkata").toDate(); // Manual update

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Blog (Protected)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.author.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    await blog.deleteOne();
    res.json({ message: "Blog deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
