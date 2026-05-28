resource "aws_sqs_queue" "TrackLabJobs" {
  name                       = "TrackLabJobs"
  max_message_size           = 262144
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300

  tags = {}
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/track-lab/prod/DATABASE_URL"
  type  = "SecureString"
  value = "managed-outside-terraform"

  lifecycle {
    ignore_changes = [
      value
    ]
  }
}

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "/track-lab/prod/OPENAI_API_KEY"
  type  = "SecureString"
  value = "managed-outside-terraform"

  lifecycle {
    ignore_changes = [
      value
    ]
  }
}

resource "aws_ssm_parameter" "spotify_client_secret" {
  name  = "/track-lab/prod/SPOTIFY_CLIENT_SECRET"
  type  = "SecureString"
  value = "managed-outside-terraform"

  lifecycle {
    ignore_changes = [
      value
    ]
  }
}