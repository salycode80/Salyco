import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import AboutFooter from "./components/AboutFooter";
import Home from "./pages/Home";
import Gallery from "./pages/Gallery";
import ProductRegistration from "./pages/ProductRegistration";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";

function App() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/productregistration" element={<ProductRegistration />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/articles/:slug" element={<ArticleDetail />} />
      </Routes>
      <AboutFooter />
    </div>
  );
}

export default App;
