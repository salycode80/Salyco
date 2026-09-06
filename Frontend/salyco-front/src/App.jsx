import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import ScrollToTop from "./components/ScrollToTop";
import Navbar from "./components/Navbar";
import AboutFooter from "./components/AboutFooter";
import SessionTimeoutModal from "./components/SessionTimeoutModal";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import ProductsIndex from "./pages/ProductsIndex";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
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
import WarrantyRequestsPanel from "./pages/admin/WarrantyRequestsPanel";
import ReviewsPanel from "./pages/admin/ReviewsPanel";
import SuggestionsPanel from "./pages/admin/SuggestionsPanel";
import UserInfo from "./pages/UserInfo";
import SearchResults from "./pages/SearchResults";
import CartPage from "./pages/CartPage";
import CheckoutOrder from "./pages/checkout/CheckoutOrder";
import PaymentResult from "./pages/PaymentResult";
import OrderPublicPage from "./pages/OrderPublicPage";
import OrdersPanel from "./pages/admin/OrdersPanel";
import AllowedLocationsPanel from "./pages/admin/AllowedLocationsPanel";

function App() {
  return (
    // AuthProvider is outermost so every consumer — including CartProvider, if it
    // ever moves off its localStorage poll — sees the same session state.
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <div>
            <ScrollToTop />
            <Navbar />
            <Routes>
            <Route path="/" element={<Home />} />
            {/* Product catalogue. `mattress` is just one :category value, so the
                pre-existing /products/mattress and /products/mattress/:slug URLs
                keep resolving here — no redirects needed. */}
            <Route path="/products" element={<ProductsIndex />} />
            <Route path="/products/:category" element={<ProductList />} />
            <Route
              path="/products/:category/:slug"
              element={<ProductDetail />}
            />
            <Route
              path="/productregistration"
              element={<ProductRegistration />}
            />
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
            <Route path="/payment/result" element={<PaymentResult />} />
            {/* Public order page, opened from the confirmation SMS. Not behind
                ProtectedRoute on purpose: the link is tapped on phones that are
                usually not signed in, and the URL token is the credential. */}
            <Route path="/orders/:token" element={<OrderPublicPage />} />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutOrder />
                </ProtectedRoute>
              }
            />
            {/* Old two-step checkout routes — kept as redirects so existing links
                and bookmarks land on the unified order form. */}
            <Route
              path="/checkout/shipping"
              element={<Navigate to="/checkout" replace />}
            />
            <Route
              path="/checkout/phone"
              element={<Navigate to="/checkout" replace />}
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
              <Route
                path="warranty-requests"
                element={<WarrantyRequestsPanel />}
              />
              <Route path="reviews" element={<ReviewsPanel />} />
              <Route path="suggestions" element={<SuggestionsPanel />} />
              <Route path="orders" element={<OrdersPanel />} />
              <Route path="locations" element={<AllowedLocationsPanel />} />
            </Route>
          </Routes>
          <AboutFooter />
          {/* Rendered once; returns null unless the idle warning is up. */}
          <SessionTimeoutModal />
          </div>
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
