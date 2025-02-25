import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/addBlog.css";
import API from "../api";
import axios from "axios";

const EditBlog = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const res = await API.get(`/blogs/${id}`);
        setTitle(res.data.title); // Set title from fetched blog
        setContent(res.data.content); // Set content from fetched blog
      } catch (error) {
        console.log(error);
      }
    };

    fetchBlog();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `http://localhost:5000/api/blogs/${id}`,
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
      alert("Failed to update blog");
      console.log(error);
    }
  };

  return (
    <div className="add-blog">
      <h2>Edit the Blog</h2>
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
        />
        <button type="submit">Save Blog</button>
      </form>
    </div>
  );
};

export default EditBlog;
