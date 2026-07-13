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
import Dealers from "./pages/Dealers";
import Contact from "./pages/Contact";
import About from "./pages/About";
import AuthPage from "./pages/AuthPage";
import WarrantyStatusPage from "./pages/WarrantyStatusPage";
import MyWarrantiesPage from "./pages/MyWarrantiesPage";
import AdminWorkspace from "./pages/admin/AdminWorkspace";
import DashboardPanel from "./pages/admin/DashboardPanel";
import CreateInstancePanel from "./pages/admin/CreateInstancePanel";
import UserInfo from "./pages/UserInfo";
import SearchResults from "./pages/SearchResults";

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
        <Route path="/dealers" element={<Dealers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/warranty/mattress/:serialNumber"
          element={<WarrantyStatusPage />}
        />
        <Route path="/user-info" element={<UserInfo />} />
        <Route path="/search" element={<SearchResults />} />
        <Route
          path="/warranty/my"
          element={
            <ProtectedRoute>
              <MyWarrantiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminWorkspace />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPanel />} />
          <Route path="create" element={<CreateInstancePanel />} />
        </Route>
      </Routes>
      <AboutFooter />
    </div>
  );
}

export default App;
