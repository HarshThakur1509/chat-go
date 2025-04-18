import {Link} from "react-router-dom";

export const Nav = () => {

  
  return (
    <div className="Nav">
      <Link to="/">Home</Link>
      <Link to="/login">Login</Link>
      <Link to="/register">Register</Link>
    </div>
  )
}
