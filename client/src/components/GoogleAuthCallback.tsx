import { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthProvider";

export const GoogleAuthCallback = () => {
  const { validateAndStoreUser } = useContext(AuthContext);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const processAuth = async () => {
      try {
        console.log("Processing Google auth callback...");
        
        // Check if there's an error in the URL
        const urlParams = new URLSearchParams(location.search);
        const errorParam = urlParams.get("error");
        
        if (errorParam) {
          throw new Error(`Authentication error: ${errorParam}`);
        }
        
        // Validate the user and store their data
        const success = await validateAndStoreUser();
        
        if (success) {
          console.log("Google auth successful, user data stored");
          // Redirect to the home page or intended destination
          navigate("/", { replace: true });
        } else {
          throw new Error("Failed to validate authentication");
        }
      } catch (error) {
        console.error("Error processing Google auth callback:", error);
        setError(error instanceof Error ? error.message : "Failed to authenticate with Google");
      } finally {
        setLoading(false);
      }
    };

    processAuth();
  }, [validateAndStoreUser, navigate, location.search]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          {error}
          <div className="mt-4">
            <button 
              onClick={() => navigate("/login")} 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-3">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return null;
};