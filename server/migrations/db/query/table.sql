-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: GetUserToken :one
SELECT * FROM users
WHERE resettoken = $1 LIMIT 1;

-- name: ListUsers :many
SELECT * FROM users
ORDER BY name;

-- name: CreateUser :one
INSERT INTO users (
  email, name, password, resettoken, tokenexpiry
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING *;



-- name: UpdateUserToken :exec
UPDATE users
  set resettoken = $2,
  tokenexpiry = $3
WHERE id = $1;

-- name: UpdateUserPassword :exec
UPDATE users
  set password = $2,
  resettoken = $3,
  tokenexpiry = $4
WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;

