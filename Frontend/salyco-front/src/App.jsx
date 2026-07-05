import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import AboutFooter from "./components/AboutFooter";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Mattress from "./pages/Mattress";
import MattressDetail from "./pages/MattressDetail";
import ProductRegistration from "./pages/ProductRegistration";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";
import AuthPage from "./pages/AuthPage";
import WarrantyStatusPage from "./pages/WarrantyStatusPage";
import MyWarrantiesPage from "./pages/MyWarrantiesPage";
import AdminCreateInstancePage from "./pages/AdminCreateInstancePage";
import UserInfo from "./pages/UserInfo";

function App() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products/mattress" element={<Mattress />} />
        <Route path="/products/mattress/:slug" element={<MattressDetail />} />
        <Route path="/productregistration" element={<ProductRegistration />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/articles/:slug" element={<ArticleDetail />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/warranty/mattress/:serialNumber"
          element={<WarrantyStatusPage />}
        />
        <Route path="/user-info" element={<UserInfo />} />
        <Route
          path="/warranty/my"
          element={
            <ProtectedRoute>
              <MyWarrantiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/instances"
          element={
            <ProtectedRoute>
              <AdminCreateInstancePage />
            </ProtectedRoute>
          }
        />
      </Routes>
      <AboutFooter />
    </div>
  );
}

export default App;
