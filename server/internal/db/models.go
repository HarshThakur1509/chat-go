// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.28.0

package db

import (
	"github.com/jackc/pgx/v5/pgtype"
)

type User struct {
	ID          int32
	Email       string
	Name        string
	Password    string
	Resettoken  string
	Tokenexpiry pgtype.Timestamptz
	CreatedAt   pgtype.Timestamptz
	UpdatedAt   pgtype.Timestamptz
	DeletedAt   pgtype.Timestamptz
}
