import { useNavigate } from "react-router-dom";

const BlogCard = ({ blog }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    console.log("Navigating to blog:", blog._id);
    navigate(`/blogs/${blog._id}`);
  };

  return (
    <div
      className="blog-card"
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      <h3>{blog.title}</h3>
      <p>{blog.content.slice(0, 100)}...</p>
      <span className="read-more">Read More</span>
    </div>
  );
};

export default BlogCard;
