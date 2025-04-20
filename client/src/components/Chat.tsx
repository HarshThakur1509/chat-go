import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatBody from "./ChatBody";
import { WebsocketContext } from "../contexts/WebsocketProvider";
import { AuthContext } from "../contexts/AuthProvider";

const API_URL = "http://localhost:3000";
const WEBSOCKET_URL = "ws://localhost:3000";

// Define types for the chat messages and users
interface Message {
  content: string;
  username: string;
  timestamp?: string;
  type: "self" | "recv";
}

interface User {
  username: string;
  id?: string;
}

interface MessageEvent {
  type: string;
  username: string;
  content?: string;
  timestamp?: string;
  messages?: Array<{
    content: string;
    username: string;
    timestamp?: string;
  }>;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]); // Initialize as empty array instead of null
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { conn, setConn, closeConn, connectionStatus, reconnect } = useContext(WebsocketContext);
  const { user } = useContext(AuthContext);
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Define setupConnection function outside useEffect so it can be called from elsewhere
  const setupConnection = () => {
    // Only set up connection if one doesn't exist already or if it's not in good state
    if (!conn || connectionStatus === "closed" || connectionStatus === "error") {
      try {
        const ws = new WebSocket(
          `${WEBSOCKET_URL}/ws/join/${roomId}?userId=${user?.id}&username=${user?.username}`
        );

        ws.addEventListener("open", () => {
          console.log("WebSocket connection established");
          setConn(ws, `${WEBSOCKET_URL}/ws/join/${roomId}?userId=${user?.id}&username=${user?.username}`);
          setError(null);
        });

        ws.addEventListener("error", (event) => {
          console.error("WebSocket error:", event);
          setError("Connection error. Please try reconnecting.");
        });

        ws.addEventListener("close", (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          if (event.code !== 1000) {
            setError("Connection closed unexpectedly. Click reconnect to try again.");
          }
        });

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as MessageEvent;

            // Handle user events
            if (msg.type === "user_joined") {
              setUsers((prev) => [...prev, { username: msg.username }]);
            } else if (msg.type === "user_left") {
              setUsers((prev) =>
                prev.filter((u) => u.username !== msg.username)
              );
            } else if (msg.type === "history") {
              // Handle message history
              if (Array.isArray(msg.messages)) {
                const formattedMessages = msg.messages.map((m) => ({
                  ...m,
                  type: m.username === user?.username ? "self" : "recv",
                })) as Message[];
                setMessages(formattedMessages);
              }
            } else {
              // Regular message
              const messageType =
                msg.username === user?.username ? "self" : "recv";
              setMessages((prev) => [...prev, { ...msg, type: messageType } as Message]);
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        };

        return ws;
      } catch (error) {
        console.error("Error establishing WebSocket connection:", error);
        setError("Failed to connect to chat. Please try again.");
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!user) {
      navigate("/login", { state: { from: `/chat/${roomId}` } });
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch room users
        const res = await fetch(`${API_URL}/ws/clients/${roomId}`);
        if (!res.ok) throw new Error("Failed to fetch room users");
        const data = await res.json();

        // Make sure data is an array
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          console.error("Expected users data to be an array, got:", data);
          setUsers([]); // Fallback to empty array
        }

        // Only set up a new connection if we don't have one
        if (connectionStatus !== "open") {
          setupConnection();
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setError("Failed to load chat data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    // Don't automatically close the connection on unmount
    // We'll let the WebsocketProvider manage the connection lifecycle
    return () => {
      // Only close if we're navigating away from chat completely
      // This prevents the recursive connection issue
      if (!window.location.pathname.includes('/chat/')) {
        closeConn();
      }
    };
  }, [roomId, user, connectionStatus, closeConn, navigate, setConn, reconnect]);

  // Custom auto-resize textarea handler function
  const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set the height to scrollHeight to fit content
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = () => {
    if (!textareaRef.current?.value.trim() || !conn || isSending) return;

    if (conn.readyState === WebSocket.OPEN) {
      setIsSending(true);

      try {
        conn.send(textareaRef.current.value);
        textareaRef.current.value = "";
        // Reset textarea height after sending
        textareaRef.current.style.height = 'auto';
      } catch (error) {
        console.error("Error sending message:", error);
        setError("Failed to send message. Please try again.");
      } finally {
        setIsSending(false);
      }
    } else {
      console.error("WebSocket connection is not open");
      setError("Connection lost. Please click reconnect.");
    }
  };

  const handleReconnect = () => {
    if (connectionStatus === "open") {
      // Already connected
      setError(null);
      return;
    }
    
    // If we have reconnection info in the context, use that
    if (reconnect) {
      reconnect();
    } else {
      // Otherwise set up a new connection
      closeConn(); // Close any potentially hanging connections
      setupConnection();
    }
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="chat-container">
    {error && (
      <div className="error-banner">
        {error}
        <button onClick={handleReconnect} className="reconnect-button">
          Reconnect
        </button>
      </div>
    )}

    <div className="chat-header">
      <h1>Chat Room</h1>
      <div className="chat-controls">
        <span className="online-count">
          {Array.isArray(users) ? users.length : 0} users online
        </span>
        <button
          onClick={() => {
            closeConn();
            navigate("/");
          }}
          className="leave-button"
        >
          Leave
        </button>
      </div>
    </div>

    <div className="messages-area">
      {!Array.isArray(messages) || messages.length === 0 ? (
        <div className="empty-messages">No messages yet. Send the first one!</div>
      ) : (
        <ChatBody data={messages} />
      )}
      <div ref={messagesEndRef} />
    </div>

    <div className="input-container">
      <textarea
        ref={textareaRef}
        className="message-input"
        placeholder="Type your message..."
        onChange={autoResizeTextarea}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={sendMessage}
        className="form-button send-button"
        disabled={isSending || connectionStatus !== "open"}
      >
        {isSending ? "Sending..." : connectionStatus !== "open" ? "Disconnected" : "Send"}
      </button>
    </div>
  </div>
  );
};

export default Chat;