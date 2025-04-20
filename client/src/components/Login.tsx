import { useState, useContext, useEffect, FormEvent} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthProvider";

interface LocationState {
  from?: string;
}

export const Login = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { authenticated, login, googleLogin, authError, clearAuthError } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination from state or default to home
  const from = (location.state as LocationState)?.from || "/";

  const handleGoogleLogin = () => {
    // Use the correct callback URL
    const callbackUrl = window.location.origin + "/auth/google/callback";
    const link = `http://localhost:3000/auth?provider=google&callback=${encodeURIComponent(callbackUrl)}`;
    googleLogin(link);
  };

  useEffect(() => {
    // If already authenticated, redirect to intended destination
    if (authenticated) {
      navigate(from, { replace: true });
    }
  }, [authenticated, navigate, from]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await login(email, password);
      if (success) {
        // Login was successful, navigation will happen via the useEffect
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h1 className="auth-title">Welcome to Chat App</h1>
        <p className="auth-subtitle">Please login to continue</p>

        {authError && (
          <div className="error-banner">
            <span>{authError}</span>
            <button onClick={clearAuthError} className="close-button">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form-content">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="form-button google-button"
          >
            {/* Keep SVG */}
            Continue with Google
          </button>

          <button
            type="submit"
            className="form-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};