package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"test/internal/db"
	"test/internal/initializers"
	"test/internal/utils"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/markbates/goth/gothic"
	"golang.org/x/crypto/bcrypt"
)

func Validate(w http.ResponseWriter, r *http.Request) {
	// Retrieve user ID from the session
	userID, err := gothic.GetFromSession("user_id", r)
	id, _ := strconv.Atoi(userID)
	user, _ := db.New(initializers.DB).GetUser(r.Context(), int32(id))

	// Create response DTO without sensitive fields
	type UserResponse struct {
		ID    int32  `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	userResponse := UserResponse{
		ID:    user.ID,
		Name:  user.Name,
		Email: user.Email,
	}

	// Respond with the user information as JSON
	w.Header().Set("Content-Type", "application/json")
	userModel, err := json.Marshal(userResponse)
	if err != nil {
		http.Error(w, "Failed to marshal user", http.StatusInternalServerError)
		return
	}
	w.Write(userModel)
}

// CUSTOM AUTHENTICATION

func CustomRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string
		Password string
		Name     string
	}

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "Failed to Read Body", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)

	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusBadRequest)
		return

	}

	// verify, err := utils.VerifyEmail(body.Email)
	// if err != nil {
	// 	http.Error(w, "Failed to verify email", http.StatusBadRequest)
	// 	return
	// }
	// if verify.HostExists == false || verify.Deliverable == false {
	// 	http.Error(w, "Invalid email", http.StatusBadRequest)
	// 	return
	// }

	userStruct := db.CreateUserParams{
		Email:       body.Email,
		Password:    string(hash),
		Name:        body.Name,
		Resettoken:  "",
		Tokenexpiry: pgtype.Timestamptz{Time: time.Time{}, Valid: true},
	}

	_, err = db.New(initializers.DB).GetUserEmail(r.Context(), body.Email)
	if err == nil {
		// User already exists

		http.Error(w, "Email already registered", http.StatusBadRequest)
		return
	}

	// Create new user
	_, err = db.New(initializers.DB).CreateUser(r.Context(), userStruct)
	if err != nil {
		log.Printf("Failed to create user: %v (Details: %+v)", err, userStruct)
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Signup successful"})
}

func CustomLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string
		Password string
	}
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "Failed to Read body", http.StatusBadRequest)
		return
	}

	user, _ := db.New(initializers.DB).GetUserEmail(r.Context(), body.Email)

	if user.ID == 0 {
		http.Error(w, "Invalid email or password", http.StatusBadRequest)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(body.Password))
	if err != nil {
		http.Error(w, "Invalid email or password", http.StatusBadRequest)
		return
	}

	// Save user ID in the session
	var id string = strconv.FormatUint(uint64(user.ID), 10)
	err = gothic.StoreInSession("user_id", id, r, w)
	if err != nil {
		http.Error(w, "Failed to save session", http.StatusInternalServerError)
		log.Println(err)
		return
	}

	// Return an empty JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Login successful"})
}

func ForgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	// email := r.FormValue("email")

	var body struct {
		Email string
	}

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "Failed to Read Body", http.StatusBadRequest)
		return
	}
	// Fetch the user by email
	user, _ := db.New(initializers.DB).GetUserEmail(r.Context(), body.Email)

	// Generate reset token and set expiration
	token, err := utils.RandomToken()
	if err != nil {
		http.Error(w, "Unable to generate reset token", http.StatusInternalServerError)
		return
	}

	// Update the database with token and expiration

	userToken := db.UpdateUserTokenParams{
		ID:          user.ID,
		Resettoken:  "",
		Tokenexpiry: pgtype.Timestamptz{Time: time.Now().Add(1 * time.Hour), Valid: true},
	}
	db.New(initializers.DB).UpdateUserToken(r.Context(), userToken)

	// Simulate email by printing the reset link
	link := "http://localhost:5173/reset-password?token=" + token
	utils.SendEmail("example@gmail.com", user.Email, link)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Password reset link sent"))
}

func ResetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	// Parse token and new password from the request body
	var requestData struct {
		Token       string `json:"token"`
		NewPassword string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate the inputs
	if requestData.Token == "" || requestData.NewPassword == "" {
		http.Error(w, "Token and password are required", http.StatusBadRequest)
		return
	}

	// Fetch user by reset token
	user, err := db.New(initializers.DB).GetUserToken(r.Context(), requestData.Token)
	if err != nil {

		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Check if the token has expired
	if user.Tokenexpiry.Time.Before(time.Now()) {
		http.Error(w, "Token has expired", http.StatusUnauthorized)
		return
	}

	// Hash the new password
	hash, err := bcrypt.GenerateFromPassword([]byte(requestData.NewPassword), bcrypt.DefaultCost)

	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusBadRequest)
		return

	}

	// Prepare the parameters for updating the user's password
	userPass := db.UpdateUserPasswordParams{
		ID:          user.ID,
		Password:    string(hash),
		Resettoken:  "",
		Tokenexpiry: pgtype.Timestamptz{Time: time.Time{}, Valid: true},
	}

	// Update the user's password and clear the reset token and expiry
	if err := db.New(initializers.DB).UpdateUserPassword(r.Context(), userPass); err != nil {
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Password successfully updated"))
}

// OAUTH AUTHENTICATION
func GoogleCallbackHandler(w http.ResponseWriter, r *http.Request) {
	// Finalize the Google OAuth flow and get the user
	user, err := gothic.CompleteUserAuth(w, r)
	if err != nil {
		http.Error(w, "Authentication failed", http.StatusUnauthorized)
		log.Println("OAuth error:", err)
		return
	}

	q := db.New(initializers.DB)

	// Try fetching the user by email
	getUser, err := q.GetUserEmail(r.Context(), user.Email)
	if err != nil {
		// If not found, create the user
		if err == pgx.ErrNoRows {
			userStruct := db.CreateUserParams{
				Email:       user.Email,
				Password:    "", // OAuth users typically have no password
				Name:        user.Name,
				Resettoken:  "",
				Tokenexpiry: pgtype.Timestamptz{Time: time.Time{}, Valid: true},
			}

			getUser, err = q.CreateUser(r.Context(), userStruct)
			if err != nil {
				log.Printf("Failed to create user: %v", err)
				http.Error(w, "Failed to create user", http.StatusInternalServerError)
				return
			}
		} else {
			log.Printf("Database error while fetching user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	// Store the user ID in session
	userID := strconv.Itoa(int(getUser.ID))
	if err := gothic.StoreInSession("user_id", userID, r, w); err != nil {
		log.Println("Session store error:", err)
		http.Error(w, "Failed to save session", http.StatusInternalServerError)
		return
	}

	// Redirect to secure area
	redirectURL := os.Getenv("REDIRECT_SECURE")
	if redirectURL == "" {
		redirectURL = "http://localhost:5173/"
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func GothLogout(w http.ResponseWriter, r *http.Request) {
	// Clear session
	err := gothic.Logout(w, r)
	if err != nil {
		http.Error(w, "Failed to logout", http.StatusInternalServerError)
		return
	}

	// Redirect to login page
	http.Redirect(w, r, "/login", http.StatusTemporaryRedirect)
}
