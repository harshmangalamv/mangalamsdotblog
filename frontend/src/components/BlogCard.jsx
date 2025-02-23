import { useNavigate } from "react-router-dom";
import moment from "moment-timezone";

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
      data-date={moment(blog.createdAt)
        .tz("Asia/Kolkata")
        .format("DD MMM YYYY, h:mm A")}
      // data-date={blog.createdAt}
    >
      <h3>{blog.title}</h3>
      <p>{blog.content.slice(0, 100)}</p>
      {/* <button className="read-more">Read More</button> */}
    </div>
  );
};

export default BlogCard;
