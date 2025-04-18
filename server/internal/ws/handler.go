package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

// CreateRoomRequest represents the request to create a new room
type CreateRoomRequest struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// App struct holds application dependencies
type App struct {
	hub *Hub
}

// NewApp creates a new App instance
func NewApp(hub *Hub) *App {
	return &App{hub: hub}
}

// HandleCreateRoom handles the creation of a new chat room
func (a *App) HandleCreateRoom(w http.ResponseWriter, r *http.Request) {
	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	room := a.hub.CreateRoom(req.ID, req.Name)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(room)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// HandleJoinRoom handles a client joining a chat room via WebSocket
func (a *App) HandleJoinRoom(w http.ResponseWriter, r *http.Request) {
	// Extract roomId from the URL path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	var roomID string

	// Find roomId in the path segments
	for i, part := range parts {
		if part == "join" && i+1 < len(parts) {
			roomID = parts[i+1]
			break
		}
	}

	if roomID == "" {
		http.Error(w, "Room ID not provided", http.StatusBadRequest)
		return
	}

	log.Printf("Client joining room: %s", roomID)

	// Get query parameters
	query := r.URL.Query()
	clientID := query.Get("userId")
	username := query.Get("username")

	if clientID == "" || username == "" {
		http.Error(w, "userId and username are required query parameters", http.StatusBadRequest)
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading connection: %v", err)
		return
	}

	// Check if room exists
	if _, exists := a.hub.Rooms[roomID]; !exists {
		log.Printf("Room %s does not exist", roomID)
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Room does not exist"))
		conn.Close()
		return
	}

	// Create a new client
	client := NewClient(conn, clientID, roomID, username, a.hub)

	// Register client with hub
	a.hub.Register <- client

	// Send notification about new user
	a.hub.Broadcast <- &Message{
		Content:  "A new user has joined the room",
		RoomID:   roomID,
		Username: username,
	}

	// Start client communication - this will block until connection is closed
	// We need to run this in the current goroutine to keep the WebSocket connection alive
	client.Run()
}

// RoomResponse represents a room in API responses
type RoomResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// HandleGetRooms returns all available chat rooms
func (a *App) HandleGetRooms(w http.ResponseWriter, r *http.Request) {
	rooms := a.hub.GetRooms()
	roomResponses := make([]RoomResponse, 0, len(rooms))

	for _, room := range rooms {
		roomResponses = append(roomResponses, RoomResponse{
			ID:   room.ID,
			Name: room.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roomResponses)
}

// ClientResponse represents a client in API responses
type ClientResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// HandleGetClients returns all clients in a specific room
func (a *App) HandleGetClients(w http.ResponseWriter, r *http.Request) {
	// Extract roomId from the URL path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	var roomID string

	// Find roomId in the path segments
	for i, part := range parts {
		if part == "clients" && i+1 < len(parts) {
			roomID = parts[i+1]
			break
		}
	}

	if roomID == "" {
		http.Error(w, "Room ID not provided", http.StatusBadRequest)
		return
	}

	clients := a.hub.GetClients(roomID)

	clientResponses := make([]ClientResponse, 0, len(clients))
	for _, client := range clients {
		clientResponses = append(clientResponses, ClientResponse{
			ID:       client.ID,
			Username: client.Username,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clientResponses)
}
