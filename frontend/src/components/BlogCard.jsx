import { useNavigate } from "react-router-dom";
import moment from "moment-timezone";

const BlogCard = ({ blog }) => {
  const navigate = useNavigate();
  const title = blog.title;
  const content = blog.content;
  const createdAt = blog.createdAt;
  const updatedAt = blog?.updatedAt;

  const handleClick = () => {
    console.log("Navigating to blog:", blog._id);
    navigate(`/blogs/${blog._id}`);
  };

  return (
    <div
      className="blog-card blog-content"
      onClick={handleClick}
      style={{ cursor: "pointer" }}
      data-date={moment(updatedAt ? updatedAt : createdAt)
        .tz("Asia/Kolkata")
        .format("DD MMM YYYY, h:mm A")}
    >
      <div className="blog-header">
        <h3>{title}</h3>
        <div className="edit-status">
          <span>{updatedAt ? "edited" : "original"}</span>
        </div>
      </div>
      <p>{content}</p>
    </div>
  );
};

export default BlogCard;
