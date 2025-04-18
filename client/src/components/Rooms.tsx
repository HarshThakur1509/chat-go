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
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Chat Rooms</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-700 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={createRoom} className="flex gap-4 mb-8">
          <input
            type="text"
            placeholder="Enter room name"
            className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-300 focus:border-blue-500 focus:outline-none"
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
            className={`px-6 py-2 text-white rounded-md ${
              isCreating ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            disabled={!roomName.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Room"}
          </button>
        </form>

        <div className="flex justify-between items-center mb-4">
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
            className="text-blue-600 hover:text-blue-800 flex items-center"
            disabled={loading}
          >
            <svg
              className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center p-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Loading rooms...</p>
          </div>
        ) : !Array.isArray(rooms) || rooms.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No rooms available</p>
            <p className="text-sm text-gray-400 mt-2">
              Create a new room to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="p-4 border rounded-md flex justify-between items-center hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="font-semibold">{room.name}</h3>
                  <p className="text-xs text-gray-500">ID: {room.id}</p>
                </div>
                <button
                  onClick={() => joinRoom(room.id)}
                  className={`px-4 py-2 rounded-md ${
                    isJoining === room.id
                      ? "bg-green-400 text-white"
                      : "bg-green-600 text-white hover:bg-green-700"
                  } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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