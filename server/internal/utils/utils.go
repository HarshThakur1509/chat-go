package utils

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"strings"

	"gopkg.in/gomail.v2"

	emailverifier "github.com/AfterShip/email-verifier"
)

func RandomToken() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

var (
	verifier = emailverifier.
		NewVerifier().
		EnableSMTPCheck()
)

func splitEmail(email string) (username, domain string, err error) {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid email format")
	}
	return parts[0], parts[1], nil
}

func VerifyEmail(email string) (*emailverifier.SMTP, error) {
	username, domain, err := splitEmail(email)
	if err != nil {
		return nil, err
	}

	ret, err := verifier.CheckSMTP(domain, username)
	if err != nil {
		return nil, err
	}

	return ret, nil
}

func SendEmail(sender string, receiver string, link string) {

	m := gomail.NewMessage()

	// Set E-Mail sender
	m.SetHeader("From", sender)

	// Set E-Mail receivers
	m.SetHeader("To", receiver)

	// Set E-Mail subject
	m.SetHeader("Subject", "Reset password")

	// Set E-Mail body. You can set plain text or html with text/html
	m.SetBody("text/html", "<a href=\""+link+"\">Reset password</a>")

	// Settings for SMTP server
	d := gomail.NewDialer("smtp.gmail.com", 587, sender, "bjcw klus iiht wllh")

	// This is only needed when SSL/TLS certificate is not valid on server.
	// In production this should be set to false.
	d.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	// Now send E-Mail
	if err := d.DialAndSend(m); err != nil {
		fmt.Println(err)
		panic(err)
	}

	return
}
