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
        setBlogs(res.data);
      } catch (error) {
        console.log(error);
      }
    };

    fetchBlogs();
  }, []);

  return (
    <div className="blogs-container">
      <h2>Mangalam's Blog</h2>
      {blogs.length === 0 ? (
        <p>No blogs yet. Add one!</p>
      ) : (
        blogs.map((blog) => <BlogCard key={blog._id} blog={blog} />)
      )}
    </div>
  );
};

export default Blogs;
