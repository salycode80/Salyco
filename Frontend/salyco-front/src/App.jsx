import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import ScrollToTop from "./components/ScrollToTop";
import Navbar from "./components/Navbar";
import MobileTopBar from "./components/MobileTopBar";
import MobileTabBar from "./components/MobileTabBar";
import AboutFooter from "./components/AboutFooter";
import SessionTimeoutModal from "./components/SessionTimeoutModal";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import ProductsIndex from "./pages/ProductsIndex";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import ProductRegistration from "./pages/ProductRegistration";
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
import CouponsPanel from "./pages/admin/CouponsPanel";
import GalleryPanel from "./pages/admin/GalleryPanel";

// Flows that should not offer five ways to leave mid-task: signing in, paying,
// the staff console, and the SMS-opened order page.
const NO_TAB_BAR = ["/auth", "/checkout", "/payment", "/admin", "/orders"];

function App() {
  const { pathname } = useLocation();
  const showTabBar = !NO_TAB_BAR.some((p) => pathname.startsWith(p));

  return (
    // AuthProvider is outermost so every consumer — including CartProvider, if it
    // ever moves off its localStorage poll — sees the same session state.
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          {/* The bottom gutter keeps the tab bar off the footer's last row. It is
              only applied while the bar is actually rendered — otherwise the
              auth and checkout pages would carry dead space below the fold. */}
          <div className={showTabBar ? "pb-[var(--tabbar-height)] lg:pb-0" : ""}>
            <ScrollToTop />
            <Navbar />
            {/* Not gated by showTabBar: the logo and the account control are
                meant to be on every page, including the flows that deliberately
                have no bottom bar. */}
            <MobileTopBar />
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
            {/* /articles and /articles/:slug are deliberately absent: they are
                Django pages now, and every link to them is a real anchor (see
                config/serverRoutes.js). Declaring them here would shadow the
                server-rendered article with a client-rendered shell. */}
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
              <Route path="coupons" element={<CouponsPanel />} />
              <Route path="gallery" element={<GalleryPanel />} />
            </Route>
          </Routes>
          <AboutFooter />
          {showTabBar && <MobileTabBar />}
          {/* Rendered once; returns null unless the idle warning is up. */}
          <SessionTimeoutModal />
          </div>
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
