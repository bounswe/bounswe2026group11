package event_report_handler

type createEventReportBody struct {
	ReportCategory    string  `json:"report_category"`
	Message           string  `json:"message"`
	ImageConfirmToken *string `json:"image_confirm_token"`
}
