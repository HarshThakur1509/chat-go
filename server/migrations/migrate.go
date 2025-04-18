package main

import (
	"embed"
	"flag"
	"fmt"
	"log"
	"os"
	"test/internal/initializers"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Just load the environment variables, don't connect to DB yet
func init() {
	initializers.LoadEnv()
}

//go:embed db/migrations/*.sql
var migrationFiles embed.FS

func main() {
	// Parse command line flags
	upFlag := flag.Bool("up", false, "Run migrations up")
	downFlag := flag.Bool("down", false, "Rollback migrations")
	versionFlag := flag.Int("version", 0, "Migrate to specific version")
	flag.Parse()

	// Build database connection string from environment variables
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")

	if dbUser == "" || dbPassword == "" || dbName == "" || dbHost == "" || dbPort == "" {
		log.Fatal("Missing required database environment variables")
	}

	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbUser, dbPassword, dbHost, dbPort, dbName)

	// Create a new migrate instance
	d, err := iofs.New(migrationFiles, "db/migrations")
	if err != nil {
		log.Fatal("Failed to create migration source:", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", d, dbURL)
	if err != nil {
		log.Fatal("Failed to create migrate instance:", err)
	}

	// Execute the appropriate migration command
	if *upFlag {
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatal("Failed to run migrations:", err)
		}
		log.Println("Migrations applied successfully")
	} else if *downFlag {
		if err := m.Down(); err != nil && err != migrate.ErrNoChange {
			log.Fatal("Failed to rollback migrations:", err)
		}
		log.Println("Migrations rolled back successfully")
	} else if *versionFlag > 0 {
		if err := m.Migrate(uint(*versionFlag)); err != nil && err != migrate.ErrNoChange {
			log.Fatal("Failed to migrate to version:", err)
		}
		log.Printf("Migration to version %d successful", *versionFlag)
	} else {
		log.Println("No migration action specified. Use -up, -down, or -version flags.")
	}
}
