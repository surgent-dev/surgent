variable "stripe_secret_key" {
  description = "Stripe API secret key"
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
}

variable "ghcr_token" {
  description = "GitHub Container Registry authentication token"
}

variable "sqs_webhooks_queue_url" {
  description = "SQS webhooks queue URL"
}

variable "sqs_webhooks_dlq_url" {
  description = "SQS webhooks DLQ URL"
}

job "surpay" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel     = 1
    health_check     = "checks"
    min_healthy_time = "10s"
    healthy_deadline = "5m"
    auto_revert      = true
  }

  group "surpay" {
    count = 1

    restart {
      attempts = 3
      delay    = "15s"
      interval = "10m"
      mode     = "fail"
    }

    network {
      port "http" {
        static = 8090
      }
    }

    service {
      name     = "surpay"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "30s"
        timeout  = "5s"
      }
    }

    task "postgres" {
      driver = "docker"

      config {
        image        = "ghcr.io/pgmq/pg18-pgmq:latest"
        volumes      = ["surpay-postgres-data:/var/lib/postgresql"]
        network_mode = "host"
      }

      env {
        POSTGRES_USER     = "surpay"
        POSTGRES_PASSWORD = "surpay"
        POSTGRES_DB       = "surpay"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }

    task "app" {
      driver = "docker"

      config {
        image = "ghcr.io/foreveranapple/surpay:latest"
        ports = ["http"]

        auth {
          username = "foreveranapple"
          password = var.ghcr_token
        }
        network_mode = "host"
      }

      # Template block to load environment variables from .env file
      # In host networking mode, app and postgres communicate via localhost on the host
      # SERVICE_PORT is set to the static port 8090
      # Override vars (STRIPE_*) from Nomad variables if provided at deploy time
      template {
        data        = <<-EOH
# Configuration from .env file (if present)
# Nomad variables override these values at deploy time
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=1
SERVICE_HOST=0.0.0.0
STRIPE_SECRET_KEY={{ env "NOMAD_VAR_stripe_secret_key" }}
STRIPE_WEBHOOK_SECRET={{ env "NOMAD_VAR_stripe_webhook_secret" }}
SQS_WEBHOOKS_QUEUE_URL={{ env "NOMAD_VAR_sqs_webhooks_queue_url" }}
SQS_WEBHOOKS_DLQ_URL={{ env "NOMAD_VAR_sqs_webhooks_dlq_url" }}
AWS_REGION=us-east-1
EOH
        destination = "local/.env"
        env         = true
      }

      env {
        DATABASE_URL = "postgres://surpay:surpay@127.0.0.1:5432/surpay"
        SERVICE_PORT = "8090"
      }

      resources {
        cpu    = 256
        memory = 256
      }
    }
  }
}
