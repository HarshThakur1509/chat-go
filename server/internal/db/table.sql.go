// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.28.0
// source: table.sql

package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

const createUser = `-- name: CreateUser :one
INSERT INTO users (
  email, name, password, resettoken, tokenexpiry
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING id, email, name, password, resettoken, tokenexpiry, created_at, updated_at, deleted_at
`

type CreateUserParams struct {
	Email       string
	Name        string
	Password    string
	Resettoken  string
	Tokenexpiry pgtype.Timestamptz
}

func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) (User, error) {
	row := q.db.QueryRow(ctx, createUser,
		arg.Email,
		arg.Name,
		arg.Password,
		arg.Resettoken,
		arg.Tokenexpiry,
	)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Email,
		&i.Name,
		&i.Password,
		&i.Resettoken,
		&i.Tokenexpiry,
		&i.CreatedAt,
		&i.UpdatedAt,
		&i.DeletedAt,
	)
	return i, err
}

const deleteUser = `-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1
`

func (q *Queries) DeleteUser(ctx context.Context, id int32) error {
	_, err := q.db.Exec(ctx, deleteUser, id)
	return err
}

const getUser = `-- name: GetUser :one
SELECT id, email, name, password, resettoken, tokenexpiry, created_at, updated_at, deleted_at FROM users
WHERE id = $1 LIMIT 1
`

func (q *Queries) GetUser(ctx context.Context, id int32) (User, error) {
	row := q.db.QueryRow(ctx, getUser, id)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Email,
		&i.Name,
		&i.Password,
		&i.Resettoken,
		&i.Tokenexpiry,
		&i.CreatedAt,
		&i.UpdatedAt,
		&i.DeletedAt,
	)
	return i, err
}

const getUserEmail = `-- name: GetUserEmail :one
SELECT id, email, name, password, resettoken, tokenexpiry, created_at, updated_at, deleted_at FROM users
WHERE email = $1 LIMIT 1
`

func (q *Queries) GetUserEmail(ctx context.Context, email string) (User, error) {
	row := q.db.QueryRow(ctx, getUserEmail, email)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Email,
		&i.Name,
		&i.Password,
		&i.Resettoken,
		&i.Tokenexpiry,
		&i.CreatedAt,
		&i.UpdatedAt,
		&i.DeletedAt,
	)
	return i, err
}

const getUserToken = `-- name: GetUserToken :one
SELECT id, email, name, password, resettoken, tokenexpiry, created_at, updated_at, deleted_at FROM users
WHERE resettoken = $1 LIMIT 1
`

func (q *Queries) GetUserToken(ctx context.Context, resettoken string) (User, error) {
	row := q.db.QueryRow(ctx, getUserToken, resettoken)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Email,
		&i.Name,
		&i.Password,
		&i.Resettoken,
		&i.Tokenexpiry,
		&i.CreatedAt,
		&i.UpdatedAt,
		&i.DeletedAt,
	)
	return i, err
}

const listUsers = `-- name: ListUsers :many
SELECT id, email, name, password, resettoken, tokenexpiry, created_at, updated_at, deleted_at FROM users
ORDER BY name
`

func (q *Queries) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := q.db.Query(ctx, listUsers)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []User
	for rows.Next() {
		var i User
		if err := rows.Scan(
			&i.ID,
			&i.Email,
			&i.Name,
			&i.Password,
			&i.Resettoken,
			&i.Tokenexpiry,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.DeletedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const updateUserPassword = `-- name: UpdateUserPassword :exec
UPDATE users
  set password = $2,
  resettoken = $3,
  tokenexpiry = $4
WHERE id = $1
`

type UpdateUserPasswordParams struct {
	ID          int32
	Password    string
	Resettoken  string
	Tokenexpiry pgtype.Timestamptz
}

func (q *Queries) UpdateUserPassword(ctx context.Context, arg UpdateUserPasswordParams) error {
	_, err := q.db.Exec(ctx, updateUserPassword,
		arg.ID,
		arg.Password,
		arg.Resettoken,
		arg.Tokenexpiry,
	)
	return err
}

const updateUserToken = `-- name: UpdateUserToken :exec
UPDATE users
  set resettoken = $2,
  tokenexpiry = $3
WHERE id = $1
`

type UpdateUserTokenParams struct {
	ID          int32
	Resettoken  string
	Tokenexpiry pgtype.Timestamptz
}

func (q *Queries) UpdateUserToken(ctx context.Context, arg UpdateUserTokenParams) error {
	_, err := q.db.Exec(ctx, updateUserToken, arg.ID, arg.Resettoken, arg.Tokenexpiry)
	return err
}
