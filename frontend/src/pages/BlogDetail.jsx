import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api";
import "../styles/blogDetail.css";
import moment from "moment-timezone";
import { FaRegEdit, FaEdit } from "react-icons/fa";

const BlogDetail = () => {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const res = await API.get(`/blogs/${id}`);
        setBlog(res.data);
      } catch (error) {
        console.log(error);
      }
    };

    fetchBlog();
  }, [id]);

  const onHandleClick = () => {
    console.log("editing blog: ", id);
    navigate(`/blogs/edit/${id}`);
  };

  if (!blog) return <p>Loading...</p>;

  const { title, content, createdAt, updatedAt } = blog; // Now safe to destructure

  return (
    <div
      className="blog-detail blog-content"
      data-date={moment(createdAt)
        .tz("Asia/Kolkata")
        .format("DD MMM YYYY, h:mm A")}
    >
      <div>
        <h2>{title}</h2>
        <div className="actions">
          <div className="edit-status">
            <span>{updatedAt ? "edited" : "original"}</span>
          </div>
          <button
            className="edit-btn"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onHandleClick()}
          >
            {isHovered ? <FaEdit size={20} /> : <FaRegEdit size={19} />}
          </button>
        </div>
      </div>
      <p>{content}</p>
    </div>
  );
};

export default BlogDetail;
