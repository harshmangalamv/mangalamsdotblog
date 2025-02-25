import { useEffect, useState } from "react";
import API from "../api";
import BlogCard from "../components/BlogCard";
import "../styles/blogs.css";

const Blogs = () => {
  const [blogs, setBlogs] = useState([]);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const res = await API.get("/blogs");
        const sortedBlogs = res.data.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setBlogs(sortedBlogs);
      } catch (error) {
        console.log(error);
      }
    };

    fetchBlogs();
  }, []);

  return (
    <div className="blogs-container blog-content">
      {/* <h2>mangalam&apos;s blog</h2> */}
      {blogs.length === 0 ? (
        <p>No blogs yet. Add one!</p>
      ) : (
        blogs.map((blog) => <BlogCard key={blog._id} blog={blog} />)
      )}
    </div>
  );
};

export default Blogs;
