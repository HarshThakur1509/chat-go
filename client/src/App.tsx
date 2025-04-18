import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthProvider";
import { WebsocketProvider } from "./contexts/WebsocketProvider";
import Rooms from "./components/Rooms";
import {Login} from "./components/Login";
import {GoogleAuthCallback} from "./components/GoogleAuthCallback";
import {Register} from "./components/Register";
import {Nav} from "./components/Nav";
import Chat from "./components/Chat";

function App() {

  return (
    <div className="App">
      <Router>
      <AuthProvider>
      <WebsocketProvider>
      <Nav />
        <Routes>
          <Route path="/" element={<Rooms />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
          <Route path="/register" element={<Register />} />
          <Route path="/chat/:roomId" element={<Chat />} />
        </Routes>
        </WebsocketProvider>
        </AuthProvider>
      </Router>
    </div>
  )
}

export default App
