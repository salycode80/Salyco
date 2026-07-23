import { Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import ScrollToTop from "./components/ScrollToTop";
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
import ReviewsPanel from "./pages/admin/ReviewsPanel";
import SuggestionsPanel from "./pages/admin/SuggestionsPanel";
import UserInfo from "./pages/UserInfo";
import SearchResults from "./pages/SearchResults";
import CartPage from "./pages/CartPage";
import CheckoutMethod from "./pages/checkout/CheckoutMethod";
import CheckoutShipping from "./pages/checkout/CheckoutShipping";
import CheckoutPhone from "./pages/checkout/CheckoutPhone";
import OrdersPanel from "./pages/admin/OrdersPanel";
import AllowedLocationsPanel from "./pages/admin/AllowedLocationsPanel";

function App() {
  return (
    <CartProvider>
      <div>
        <ScrollToTop />
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
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutMethod />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/shipping"
          element={
            <ProtectedRoute>
              <CheckoutShipping />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/phone"
          element={
            <ProtectedRoute>
              <CheckoutPhone />
            </ProtectedRoute>
          }
        />
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
          <Route path="reviews" element={<ReviewsPanel />} />
          <Route path="suggestions" element={<SuggestionsPanel />} />
          <Route path="orders" element={<OrdersPanel />} />
          <Route path="locations" element={<AllowedLocationsPanel />} />
        </Route>
      </Routes>
        <AboutFooter />
      </div>
    </CartProvider>
  );
}

export default App;
