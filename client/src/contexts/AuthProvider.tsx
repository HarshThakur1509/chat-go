import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface UserData {
  name: string;
  id: string;
  // Replace any with a more specific record type for additional properties
  [key: string]: string | number | boolean | null;
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
  setGoogleAuthSuccess: (success: boolean) => void;
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
  setGoogleAuthSuccess: () => {},
});

const API_URL = "http://localhost:3000";

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleAuthCompleted, setGoogleAuthCompleted] = useState<boolean>(false);
  const location = useLocation();

  // Clear error whenever location changes
  useEffect(() => {
    setAuthError(null);
  }, [location]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // This function is called when the Google callback component mounts
  const setGoogleAuthSuccess = useCallback((success: boolean) => {
    setGoogleAuthCompleted(success);
  }, []);

  // Effect to handle Google auth completion
  useEffect(() => {
    if (googleAuthCompleted) {
      const validateGoogleAuth = async () => {
        try {
          const valRes = await fetch(`${API_URL}/validate`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // Include cookies if your API uses them
          });

          if (!valRes.ok) {
            throw new Error("Failed to validate Google authentication");
          }

          const valData = await valRes.json();

          const userData: UserData = {
            name: valData.name,
            id: valData.id,
          };

          // Store user data in localStorage
          localStorage.setItem("user_info", JSON.stringify(userData));

          // Update state
          setUser(userData);
          setAuthenticated(true);
        } catch (error) {
          console.error("Google auth validation error:", error);
          setAuthError(
            error instanceof Error ? error.message : "Failed to validate Google authentication."
          );
        } finally {
          // Reset the flag
          setGoogleAuthCompleted(false);
        }
      };

      validateGoogleAuth();
    }
  }, [googleAuthCompleted]);

  // Google Login function - just redirects to Google auth
  const googleLogin = useCallback((link: string): void => {
    // Simply redirect to the Google auth URL
    window.location.href = link;
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);

      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Include cookies if your API uses them
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      const valRes = await fetch(`${API_URL}/validate`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies if your API uses them
      });

      const valData = await valRes.json();

      const userData: UserData = {
        name: valData.name,
        id: valData.id,
      };

      // Store user data in localStorage
      localStorage.setItem("user_info", JSON.stringify(userData));

      // Update state
      setUser(userData);
      setAuthenticated(true);

      return true;
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(
        error instanceof Error ? error.message : "Failed to login. Please check your credentials."
      );
      return false;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem("user_info");

    // Optional: Call logout endpoint if your API has one
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
        const storedUser = localStorage.getItem("user_info");

        if (storedUser) {
          const userData: UserData = JSON.parse(storedUser);

          // Optional: Verify token/session with backend
          // This helps ensure the stored user data is still valid
          try {
            const verifyRes = await fetch(`${API_URL}/validate`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
            });

            if (verifyRes.ok) {
              // User is authenticated
              setUser(userData);
              setAuthenticated(true);
            } else {
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
    setGoogleAuthSuccess,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};