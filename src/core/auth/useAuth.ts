import { useAuthStore } from "./authStore";
import {
  signInWithPassword,
  signOut,
  resetPasswordForEmail,
  validateCurrentSession,
  readRememberedEmail,
} from "./authService";
import {
  isSuperAdmin,
  isRegularCustomer,
  isSTUCustomer,
  getCustomerTier,
  getDefaultRouteForUser,
} from "../authorization/customerTier";
import { getUserRouteAccess, hasUserFeature } from "../authorization/featureFlags";

export function useAuth() {
  const { isAuthenticated, user, rememberMe, setRememberMe, login, logout, updateUser } =
    useAuthStore();

  const superAdmin = isSuperAdmin(user);
  const regularCustomer = isRegularCustomer(user);
  const stuCustomer = isSTUCustomer(user);
  const tier = getCustomerTier(user);
  const defaultRoute = getDefaultRouteForUser(user);
  const routeAccess = getUserRouteAccess(user);

  return {
    isAuthenticated,
    user,
    rememberMe,
    setRememberMe,
    login,
    logout,
    updateUser,
    isSuperAdmin: superAdmin,
    isRegularCustomer: regularCustomer,
    isSTUCustomer: stuCustomer,
    customerTier: tier,
    defaultRoute,
    routeAccess,
    hasFeature: (feature: string) => hasUserFeature(user, feature),
    signIn: signInWithPassword,
    signOut,
    resetPassword: resetPasswordForEmail,
    validateSession: validateCurrentSession,
    readRememberedEmail,
  };
}

export default useAuth;

