ddown:
	docker compose down

dup:
	docker compose up --build -d

res: ddown dup

mup:
	go run migrations/migrate.go -up

mdown:
	go run migrations/migrate.go -down

run:
	wgo run cmd/main.go