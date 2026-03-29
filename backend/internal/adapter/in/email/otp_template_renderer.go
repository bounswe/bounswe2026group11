package email

import (
	"bytes"
	"embed"
	"fmt"
	htmltemplate "html/template"
	texttemplate "text/template"
)

//go:embed templates/auth-otp.html.tmpl templates/auth-otp.txt.tmpl
var otpTemplatesFS embed.FS

var (
	authOTPHTMLTemplate = htmltemplate.Must(
		htmltemplate.New("auth-otp.html.tmpl").ParseFS(otpTemplatesFS, "templates/auth-otp.html.tmpl"),
	)
	authOTPTextTemplate = texttemplate.Must(
		texttemplate.New("auth-otp.txt.tmpl").ParseFS(otpTemplatesFS, "templates/auth-otp.txt.tmpl"),
	)
)

type otpTemplateRenderer struct{}

type otpTemplateData struct {
	PreviewText string
	Heading     string
	Intro       string
	Code        string
	ExpiryText  string
	IgnoreText  string
}

func newOTPTemplateRenderer() otpTemplateRenderer {
	return otpTemplateRenderer{}
}

func (otpTemplateRenderer) Render(data otpTemplateData) (string, string, error) {
	var htmlBuffer bytes.Buffer
	if err := authOTPHTMLTemplate.Execute(&htmlBuffer, data); err != nil {
		return "", "", fmt.Errorf("render html otp template: %w", err)
	}

	var textBuffer bytes.Buffer
	if err := authOTPTextTemplate.Execute(&textBuffer, data); err != nil {
		return "", "", fmt.Errorf("render text otp template: %w", err)
	}

	return htmlBuffer.String(), textBuffer.String(), nil
}
