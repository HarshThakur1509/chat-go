import { createContext, useState, useCallback, useEffect, ReactNode } from "react";

// Define types for the context value
interface WebsocketContextType {
  conn: WebSocket | null;
  setConn: (newConn: WebSocket, url?: string, options?: string | string[]) => void;
  closeConn: () => void;
  connectionStatus: "closed" | "connecting" | "open" | "error";
  reconnect: () => void;
  reconnectInfo: ReconnectInfo | null;
}

// Define reconnect info type
interface ReconnectInfo {
  url: string;
  options?: string | string[];
}

// Define props type for the provider component
interface WebsocketProviderProps {
  children: ReactNode;
}

export const WebsocketContext = createContext<WebsocketContextType>({
  conn: null,
  setConn: () => {},
  closeConn: () => {},
  connectionStatus: "closed", // "closed", "connecting", "open", "error"
  reconnect: () => {},
  reconnectInfo: null
});

export const WebsocketProvider = ({ children }: WebsocketProviderProps) => {
  const [conn, setConn] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebsocketContextType["connectionStatus"]>("closed");
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null);

  // Monitor WebSocket connection status
  useEffect(() => {
    if (!conn) {
      setConnectionStatus("closed");
      return;
    }

    const updateStatus = () => {
      switch (conn.readyState) {
        case WebSocket.CONNECTING:
          setConnectionStatus("connecting");
          break;
        case WebSocket.OPEN:
          setConnectionStatus("open");
          break;
        case WebSocket.CLOSING:
        case WebSocket.CLOSED:
          setConnectionStatus("closed");
          break;
        default:
          setConnectionStatus("error");
      }
    };

    // Set initial status
    updateStatus();

    // Add event listeners to update status
    const handleOpen = () => setConnectionStatus("open");
    const handleClose = () => setConnectionStatus("closed");
    const handleError = () => setConnectionStatus("error");

    conn.addEventListener("open", handleOpen);
    conn.addEventListener("close", handleClose);
    conn.addEventListener("error", handleError);

    // Cleanup
    return () => {
      conn.removeEventListener("open", handleOpen);
      conn.removeEventListener("close", handleClose);
      conn.removeEventListener("error", handleError);
    };
  }, [conn]);

  const closeConn = useCallback(() => {
    if (conn) {
      try {
        // Only close the connection if it's not already closed
        if (
          conn.readyState !== WebSocket.CLOSED &&
          conn.readyState !== WebSocket.CLOSING
        ) {
          conn.close(1000, "Normal closure");
        }
      } catch (error) {
        console.error("Error closing WebSocket:", error);
      } finally {
        setConn(null);
        setConnectionStatus("closed");
      }
    }
  }, [conn]);

  const reconnect = useCallback(() => {
    if (reconnectInfo) {
      try {
        // If there's an existing connection, close it first
        if (conn) {
          if (conn.readyState === WebSocket.OPEN || conn.readyState === WebSocket.CONNECTING) {
            conn.close(1000, "Reconnecting");
          }
          // Clear the reference
          setConn(null);
        }

        // Create new connection with stored details
        const { url, options } = reconnectInfo;
        console.log("Reconnecting to:", url);
        const newConn = new WebSocket(url, options);
        setConn(newConn);
        setConnectionStatus("connecting");
      } catch (error) {
        console.error("Error reconnecting:", error);
        setConnectionStatus("error");
      }
    } else {
      console.warn("No reconnection information available");
    }
  }, [reconnectInfo, conn]);

  // Enhanced setConn that stores reconnection info
  const setConnWithInfo = useCallback((newConn: WebSocket, url?: string, options?: string | string[]) => {
    setConn(newConn);
    if (url) {
      setReconnectInfo({ url, options });
    }
  }, []);

  return (
    <WebsocketContext.Provider
      value={{
        conn,
        setConn: setConnWithInfo,
        closeConn,
        connectionStatus,
        reconnect,
        reconnectInfo
      }}
    >
      {children}
    </WebsocketContext.Provider>
  );
};