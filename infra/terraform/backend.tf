terraform {
  backend "s3" {
    bucket         = "track-lab-terraform-state-669424048162"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "track-lab-terraform-locks"
    encrypt        = true
  }
}