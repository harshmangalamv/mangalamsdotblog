import { Link } from "react-router-dom";
import "../styles/navbar.css";
import { useEffect } from "react";

const Navbar = () => {
    useEffect(() => {
      const navbar = document.querySelector(".navbar");
      document.documentElement.style.setProperty(
        "padding-top",
        `${navbar.offsetHeight}px`
      );
    }, []);

  return (
    <nav className="navbar">
      <Link to="/">mangalams</Link>
      <Link to="/addBlog">add</Link>
    </nav>
  );
};

export default Navbar;
