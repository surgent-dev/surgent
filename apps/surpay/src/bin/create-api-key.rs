use argon2::{
    Argon2, PasswordHasher,
    password_hash::{SaltString, rand_core::OsRng},
};
use clap::Parser;
use sqlx::PgPool;
use uuid::Uuid;

/// Create a new API key in the database
#[derive(Parser, Debug)]
#[command(version, long_about = None)]
struct Args {
    /// The display name for the API key
    #[arg(long)]
    name: String,

    /// A unique slug identifier for the API key
    #[arg(long)]
    slug: String,

    /// The user ID to associate with this API key
    #[arg(long)]
    user_id: Uuid,
}

fn generate_api_key() -> (String, String, String) {
    use rand::Rng;
    let mut rng = rand::rng();

    let prefix: String = (0..8)
        .map(|_| rng.sample(rand::distr::Alphanumeric) as char)
        .collect::<String>()
        .to_lowercase();

    let secret: String = (0..32)
        .map(|_| rng.sample(rand::distr::Alphanumeric) as char)
        .collect();

    let full_key = format!("sp_master_{}_{}", prefix, secret);
    (full_key, prefix, secret)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let args = Args::parse();

    let database_url =
        std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL environment variable not set")?;

    let pool = PgPool::connect(&database_url).await?;

    let api_key_id = Uuid::new_v4();

    let (key_full, prefix, secret) = generate_api_key();

    let argon2 = Argon2::default();

    let salt = SaltString::generate(&mut OsRng);
    let secret_hash = argon2
        .hash_password(secret.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    sqlx::query!(
        r#"
        INSERT INTO apikey (
            id,
            name,
            "key",
            prefix,
            "userId",
            "createdAt",
            "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        "#,
        api_key_id,
        args.name,
        secret_hash,
        prefix,
        args.user_id
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    println!("Created API key: {} ({})", args.name, args.slug);
    println!("API Key: {}", key_full);
    println!();
    println!("⚠️  Save this key now! The secret cannot be recovered.");

    Ok(())
}
