package routes

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"test/internal/handlers"
	"test/internal/initializers"
	"test/internal/middleware"
	"test/internal/ws"

	"github.com/markbates/goth/gothic"
	"github.com/rs/cors"
)

type ApiServer struct {
	addr string
}

func NewApiServer(addr string) *ApiServer {
	return &ApiServer{addr: addr}
}

func (s *ApiServer) Run() error {
	// Initialize database connection
	if err := initializers.ConnectDB(); err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer initializers.CloseDB() // Ensure cleanup

	// Create a new http.ServeMux for routing
	router := http.NewServeMux()

	// Initialize WebSocket hub
	hub := ws.NewHub()
	// Start hub in a goroutine
	go hub.Run()

	// Create a new WebSocket app
	app := ws.NewApp(hub)

	// WebSocket routes
	router.HandleFunc("POST /ws/create-room", app.HandleCreateRoom)

	// The join room handler needs special care because it upgrades to WebSocket
	router.HandleFunc("GET /ws/join/", func(w http.ResponseWriter, r *http.Request) {
		app.HandleJoinRoom(w, r)
	})

	router.HandleFunc("GET /ws/rooms", app.HandleGetRooms)

	// Clients endpoint
	router.HandleFunc("GET /ws/clients/", func(w http.ResponseWriter, r *http.Request) {
		app.HandleGetClients(w, r)
	})

	// USER AUTHENTICATION
	router.HandleFunc("POST /login", handlers.CustomLogin)
	router.HandleFunc("POST /register", handlers.CustomRegister)
	router.HandleFunc("POST /reset", handlers.ResetPasswordHandler)
	router.HandleFunc("POST /forgot", handlers.ForgotPasswordHandler)
	router.HandleFunc("GET /auth", gothic.BeginAuthHandler)
	router.HandleFunc("GET /auth/callback", handlers.GoogleCallbackHandler)

	// Authentication required routes
	authRouter := http.NewServeMux()
	authRouter.HandleFunc("GET /auth/logout", handlers.GothLogout)
	authRouter.HandleFunc("GET /validate", handlers.Validate)
	router.Handle("/", middleware.AuthMiddleware(authRouter))

	// Apply middleware chain
	stack := middleware.MiddlewareChain(middleware.Logger, middleware.RecoveryMiddleware)

	// Configure CORS
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"}, // Frontend origin
		AllowCredentials: true,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{
			"Content-Type",
			"Authorization",
		},
	}).Handler(stack(router))

	// Create server
	server := http.Server{
		Addr:    s.addr,
		Handler: corsHandler,
	}

	// Channel to listen for interrupt signal to gracefully shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on %s", s.addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Error starting server: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-stop
	log.Println("Shutting down server...")

	// TODO: Add proper graceful shutdown code here
	// This would include closing WebSocket connections, etc.

	return nil
}
