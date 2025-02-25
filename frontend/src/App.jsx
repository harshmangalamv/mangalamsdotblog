import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/NavBar";
import Blogs from "./pages/Blogs";
import BlogDetail from "./pages/BlogDetail";
import AddBlog from "./pages/AddBlog";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import "./App.css";
import EditBlog from "./pages/EditBlog";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Blogs />} />
        <Route path="/blogs" element={<Blogs />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/addBlog" element={<AddBlog />} />
        <Route path="/blogs/:id" element={<BlogDetail />} />
        <Route path="/blogs/edit/:id" element={<EditBlog />} />
      </Routes>
    </Router>
  );
}

export default App;
