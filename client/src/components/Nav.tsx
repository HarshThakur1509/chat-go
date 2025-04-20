import {Link} from "react-router-dom";

export const Nav = () => {

  
  return (
    <div className="nav-container">
  <Link className="nav-link" to="/">Home</Link>
  <Link className="nav-link" to="/login">Login</Link>
  <Link className="nav-link" to="/register">Register</Link>
</div>
  )
}
