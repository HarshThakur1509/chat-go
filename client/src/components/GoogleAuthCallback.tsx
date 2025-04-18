import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthProvider";

export const GoogleAuthCallback = () => {
  const { setGoogleAuthSuccess } = useContext(AuthContext);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      try {
        // Inform the AuthProvider that Google auth has completed
        setGoogleAuthSuccess(true);
        
        // Redirect to the home page or intended destination
        navigate("/", { replace: true });
      } catch (error) {
        console.error("Error processing Google auth callback:", error);
        setError("Failed to authenticate with Google. Please try again.");
      }
    };

    processAuth();
  }, [setGoogleAuthSuccess, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Completing authentication...</p>
      </div>
    </div>
  );
};