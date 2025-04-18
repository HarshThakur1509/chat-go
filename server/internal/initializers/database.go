package initializers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

// ConnectDB establishes a connection to the PostgreSQL database
func ConnectDB() error {
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")

	// Validate required environment variables
	if dbUser == "" || dbPassword == "" || dbName == "" || dbHost == "" || dbPort == "" {
		return errors.New("missing required database environment variables")
	}

	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbUser, dbPassword, dbHost, dbPort, dbName)

	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return fmt.Errorf("failed to parse database config: %w", err)
	}

	// Configure connection pool
	config.MaxConns = 10                               // Maximum number of connections in the pool
	config.MinConns = 2                                // Minimum number of idle connections
	config.MaxConnLifetime = 30 * time.Minute          // Maximum lifetime of a connection
	config.MaxConnIdleTime = 5 * time.Minute           // Maximum idle time for a connection
	config.HealthCheckPeriod = 1 * time.Minute         // How often to check connection health
	config.ConnConfig.ConnectTimeout = 5 * time.Second // Connection timeout

	// Connect with retry logic
	var retries int = 5
	var retryDelay time.Duration = 5 * time.Second

	for i := 0; i < retries; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		DB, err = pgxpool.NewWithConfig(ctx, config)
		cancel()

		if err == nil {
			break
		}

		log.Printf("Failed to connect to database (attempt %d/%d): %v", i+1, retries, err)
		if i < retries-1 {
			log.Printf("Retrying in %v...", retryDelay)
			time.Sleep(retryDelay)
		}
	}

	if err != nil {
		return fmt.Errorf("all connection attempts failed: %w", err)
	}

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := DB.Ping(ctx); err != nil {
		CloseDB() // Clean up if ping fails
		return fmt.Errorf("database ping failed: %w", err)
	}

	log.Println("Database connection established successfully")
	return nil
}

// CloseDB gracefully closes the database connection pool
func CloseDB() {
	if DB != nil {
		log.Println("Closing database connection pool...")
		DB.Close()
		log.Println("Database connection pool closed")
	}
}
