import { useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import "../styles/addBlog.css";
import axios from "axios";

const AddBlog = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // await API.post("/blogs", { title, content });
      await axios.post(
        "http://localhost:5000/api/blogs",
        { title, content },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: localStorage.getItem("token"),
          },
        }
      );
      navigate("/blogs");
    } catch (error) {
      alert("Failed to post blog");
      console.log(error);
    }
  };

  return (
    <div className="add-blog">
      <h2>Add a New Blog</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        ></textarea>
        <button type="submit">Add Blog</button>
      </form>
    </div>
  );
};

export default AddBlog;
