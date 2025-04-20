import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { AuthContext } from "../contexts/AuthProvider";
import { WebsocketContext } from "../contexts/WebsocketProvider";

const API_URL = "http://localhost:3000";
const WEBSOCKET_URL = "ws://localhost:3000";

interface Room {
  id: string;
  name: string;
}

interface ErrorResponse {
  message?: string;
}

const Rooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<string | null>(null); // Stores roomId being joined
  const [error, setError] = useState<string>("");
  const { user } = useContext(AuthContext);
  const { setConn, closeConn, connectionStatus } = useContext(WebsocketContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    // Close any existing connection when viewing the rooms list
    closeConn();

    const fetchRooms = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/ws/rooms`);
        if (!res.ok) throw new Error("Failed to fetch rooms");
        const data = await res.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid rooms data format");
        }

        setRooms(data);
        setError("");
      } catch (error) {
        console.error("Error fetching rooms:", error);
        setError("Failed to load rooms. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();

    // Refresh rooms list periodically
    const intervalId = setInterval(fetchRooms, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, navigate, location.pathname, closeConn]);

  const createRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError("Room name cannot be empty");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/ws/create-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: uuidv4(),
          name: roomName.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({})) as ErrorResponse;
        throw new Error(errorData.message || "Failed to create room");
      }

      const newRoom = await res.json() as Room;
      setRooms((prevRooms) =>
        Array.isArray(prevRooms) ? [...prevRooms, newRoom] : [newRoom]
      );
      setRoomName("");
      setError("");

      // Automatically join the newly created room
      joinRoom(newRoom.id);
    } catch (error) {
      console.error("Error creating room:", error);
      setError((error as Error).message || "Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = (roomId: string) => {
    if (!user) {
      navigate("/login", { state: { from: `/chat/${roomId}` } });
      return;
    }

    // If we already have a connection, close it first
    if (connectionStatus === "open" || connectionStatus === "connecting") {
      closeConn();
    }

    setIsJoining(roomId);
    try {
      const ws = new WebSocket(
        `${WEBSOCKET_URL}/ws/join/${roomId}?userId=${user.id}&username=${user.username}`
      );

      ws.addEventListener("open", () => {
        console.log("WebSocket connection established");
        // Store the connection in context with reconnection info
        setConn(
          ws,
          `${WEBSOCKET_URL}/ws/join/${roomId}?userId=${user.id}&username=${user.username}`
        );
        // Navigate with roomId in URL
        navigate(`/chat/${roomId}`);
      });

      ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        setError("Failed to connect to chat room. Please try again.");
        setIsJoining(null);
      });

      ws.addEventListener("close", (event) => {
        if (event.code !== 1000) {
          console.log(
            "WebSocket closed unexpectedly:",
            event.code,
            event.reason
          );
          setError("Connection closed unexpectedly. Please try again.");
          setIsJoining(null);
        }
      });
    } catch (error) {
      console.error("Error joining room:", error);
      setError("Failed to join room. Please try again.");
      setIsJoining(null);
    }
  };

  return (
    <div className="app-container">
      <div className="rooms-container">
        <h1 className="text-3xl font-bold mb-6">Chat Rooms</h1>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="error-close"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={createRoom} className="auth-form">
          <input
            type="text"
            placeholder="Enter room name"
            className="form-input"
            value={roomName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setRoomName(e.target.value);
              if (error) setError("");
            }}
            minLength={3}
            maxLength={50}
            required
            disabled={isCreating}
          />
          <button
            type="submit"
            className={`form-button ${isCreating ? "disabled" : ""}`}
            disabled={!roomName.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Room"}
          </button>
        </form>

        <div className="room-header">
          <h2 className="text-2xl font-bold">Available Rooms</h2>
          <button
            onClick={() => {
              setLoading(true);
              fetch(`${API_URL}/ws/rooms`)
                .then((res) => res.json())
                .then((data) => {
                  if (Array.isArray(data)) {
                    setRooms(data);
                  }
                  setLoading(false);
                })
                .catch((err) => {
                  console.error("Error refreshing rooms:", err);
                  setLoading(false);
                });
            }}
            className="refresh-button"
            disabled={loading}
          >
            <div className={loading ? "loading-spinner" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading rooms...</p>
          </div>
        ) : !Array.isArray(rooms) || rooms.length === 0 ? (
          <div className="empty-rooms">
            <p className="empty-primary">No rooms available</p>
            <p className="empty-secondary">
              Create a new room to get started
            </p>
          </div>
        ) : (
          <div className="room-list">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="room-item"
              >
                <div className="room-info">
                  <h3 className="room-name">{room.name}</h3>
                  <p className="room-id">ID: {room.id}</p>
                </div>
                <button
                  onClick={() => joinRoom(room.id)}
                  className={`form-button ${isJoining === room.id ? "disabled" : ""}`}
                  disabled={isJoining !== null}
                >
                  {isJoining === room.id ? "Joining..." : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Rooms;