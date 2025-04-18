package ws

import (
	"log"
	"sync"
)

// Room represents a chat room
type Room struct {
	ID      string             `json:"id"`
	Name    string             `json:"name"`
	Clients map[string]*Client `json:"clients"`
	mu      sync.RWMutex       // Protect concurrent access to Clients map
}

// Hub maintains the set of active rooms and clients
type Hub struct {
	Rooms      map[string]*Room
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *Message
	mu         sync.RWMutex // Protect concurrent access to Rooms map
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]*Room),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *Message, 5),
	}
}

// Run starts the Hub, handling client registration/unregistration and broadcasting messages
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.RLock()
			room, exists := h.Rooms[client.RoomID]
			h.mu.RUnlock()

			if !exists {
				log.Printf("Client tried to join non-existent room: %s", client.RoomID)
				continue
			}

			room.mu.Lock()
			if _, exists := room.Clients[client.ID]; !exists {
				room.Clients[client.ID] = client
				log.Printf("Client %s joined room %s", client.Username, room.Name)
			}
			room.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.RLock()
			room, exists := h.Rooms[client.RoomID]
			h.mu.RUnlock()

			if !exists {
				continue
			}

			room.mu.Lock()
			if _, exists := room.Clients[client.ID]; exists {
				if len(room.Clients) != 0 {
					h.Broadcast <- &Message{
						Content:  "user left the chat",
						RoomID:   client.RoomID,
						Username: client.Username,
					}
					log.Printf("Client %s left room %s", client.Username, room.Name)
				}

				delete(room.Clients, client.ID)
				close(client.Message)
			}
			room.mu.Unlock()

		case msg := <-h.Broadcast:
			h.mu.RLock()
			room, exists := h.Rooms[msg.RoomID]
			h.mu.RUnlock()

			if !exists {
				log.Printf("Message sent to non-existent room: %s", msg.RoomID)
				continue
			}

			room.mu.RLock()
			for _, client := range room.Clients {
				select {
				case client.Message <- msg:
					// Message sent successfully
				default:
					// If client buffer is full, close connection and remove client
					log.Printf("Client %s buffer full, removing from room", client.Username)
					room.mu.RUnlock()
					room.mu.Lock()
					close(client.Message)
					delete(room.Clients, client.ID)
					room.mu.Unlock()
					room.mu.RLock()
				}
			}
			room.mu.RUnlock()
		}
	}
}

// CreateRoom creates a new chat room
func (h *Hub) CreateRoom(id, name string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Check if room already exists
	if _, exists := h.Rooms[id]; exists {
		log.Printf("Room already exists: %s", id)
		return h.Rooms[id]
	}

	room := &Room{
		ID:      id,
		Name:    name,
		Clients: make(map[string]*Client),
	}
	h.Rooms[id] = room
	log.Printf("Created new room: %s", name)
	return room
}

// GetRooms returns all available rooms
func (h *Hub) GetRooms() []Room {
	h.mu.RLock()
	defer h.mu.RUnlock()

	rooms := make([]Room, 0, len(h.Rooms))
	for _, room := range h.Rooms {
		// Create a copy of the room without the clients to avoid mutex issues
		roomCopy := Room{
			ID:   room.ID,
			Name: room.Name,
		}
		rooms = append(rooms, roomCopy)
	}
	return rooms
}

// GetClients returns all clients in a specific room
func (h *Hub) GetClients(roomID string) []*Client {
	h.mu.RLock()
	room, exists := h.Rooms[roomID]
	h.mu.RUnlock()

	if !exists {
		return []*Client{}
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	clients := make([]*Client, 0, len(room.Clients))
	for _, client := range room.Clients {
		// Create a copy of the client with only the necessary fields
		clientCopy := &Client{
			ID:       client.ID,
			Username: client.Username,
		}
		clients = append(clients, clientCopy)
	}
	return clients
}
