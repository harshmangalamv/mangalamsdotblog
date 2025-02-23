import { Link } from "react-router-dom";
import "../styles/navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <Link to="/">mangalams</Link>
      <Link to="/addBlog">Add Blog</Link>
    </nav>
  );
};

export default Navbar;
