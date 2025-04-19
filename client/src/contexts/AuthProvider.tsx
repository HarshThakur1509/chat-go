import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface UserData {
  name: string;
  id: string;
  email?: string;
  // Replace any with a more specific record type for additional properties
  [key: string]: string | number | boolean | null | undefined;
}

interface AuthContextType {
  authenticated: boolean;
  user: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  googleLogin: (link: string) => void;
  logout: () => void;
  authError: string | null;
  clearAuthError: () => void;
  validateAndStoreUser: () => Promise<boolean>;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  user: null,
  loading: true,
  login: () => Promise.resolve(false),
  googleLogin: () => {},
  logout: () => {},
  authError: null,
  clearAuthError: () => {},
  validateAndStoreUser: () => Promise.resolve(false),
});

const API_URL = "http://localhost:3000";

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  // Clear error whenever location changes
  useEffect(() => {
    setAuthError(null);
  }, [location]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Centralized validate and store user function
  const validateAndStoreUser = useCallback(async (): Promise<boolean> => {
    try {
      console.log("Validating user session...");
      const valRes = await fetch(`${API_URL}/validate`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session authentication
      });

      if (!valRes.ok) {
        console.error("Validation failed:", valRes.status, valRes.statusText);
        throw new Error("Failed to validate authentication");
      }

      const valData = await valRes.json();
      console.log("User validation successful");

      const userData: UserData = {
        name: valData.name,
        id: valData.id.toString(),
        email: valData.email,
      };

      // Store user data in localStorage
      localStorage.setItem("user_info", JSON.stringify(userData));
      console.log("User data stored in localStorage");

      // Update state
      setUser(userData);
      setAuthenticated(true);
      return true;
    } catch (error) {
      console.error("Auth validation error:", error);
      setAuthError(
        error instanceof Error ? error.message : "Failed to validate authentication."
      );
      return false;
    }
  }, []);

  // Google Login function - redirects to Google auth
  const googleLogin = useCallback((link: string): void => {
    console.log("Redirecting to Google auth:", link);
    // Simply redirect to the Google auth URL
    window.location.href = link;
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);
      console.log("Attempting login with email");

      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Include cookies for session authentication
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      console.log("Login successful, validating user");
      // Use the shared validation function
      return await validateAndStoreUser();
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(
        error instanceof Error ? error.message : "Failed to login. Please check your credentials."
      );
      return false;
    }
  }, [validateAndStoreUser]);

  // Logout function
  const logout = useCallback(() => {
    console.log("Logging out");
    localStorage.removeItem("user_info");

    // Call logout endpoint
    fetch(`${API_URL}/logout`, {
      method: "POST",
      credentials: "include",
    }).catch((err) => console.error("Logout API error:", err));

    // Update state
    setUser(null);
    setAuthenticated(false);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        console.log("Checking auth status");
        const storedUser = localStorage.getItem("user_info");

        if (storedUser) {
          console.log("Found stored user data, verifying with server");
          const userData: UserData = JSON.parse(storedUser);

          // Verify session with backend
          try {
            const verifyRes = await fetch(`${API_URL}/validate`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
            });

            if (verifyRes.ok) {
              console.log("Session verified");
              // User is authenticated
              setUser(userData);
              setAuthenticated(true);
            } else {
              console.log("Session invalid or expired");
              // Session expired or invalid, clear local storage
              localStorage.removeItem("user_info");
              setUser(null);
              setAuthenticated(false);
            }
          } catch (verifyError) {
            console.error("Session verification error:", verifyError);
            // If we can't reach the server, assume the user is authenticated based on local storage
            // This allows offline use if needed
            setUser(userData);
            setAuthenticated(true);
          }
        } else {
          console.log("No stored user data found");
          // No stored user data
          setUser(null);
          setAuthenticated(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // If there's an error parsing stored data, clear it
        localStorage.removeItem("user_info");
        setUser(null);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const contextValue: AuthContextType = {
    authenticated,
    user,
    loading,
    login,
    googleLogin,
    logout,
    authError,
    clearAuthError,
    validateAndStoreUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};