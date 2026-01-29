{
  description = "Surgent development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      fenix,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        fenixLib = fenix.packages.${system};
        rustToolchain = fenixLib.stable.toolchain;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Primary runtimes
            bun
            nodejs_25
            typescript

            # Build tools
            turbo

            # System utilities
            unzip
            pkg-config
            openssl

            # Database
            postgresql_18

            # Optional dev tools
            nodePackages.typescript-language-server
            nodePackages.prettier

            # Rust tooling
            rustToolchain
            rust-analyzer
            sqlx-cli
            cargo-nextest
            cargo-watch

            # Stripe test tools
            stripe-cli

            # cloud management tools
            awscli2

            # tunnel for local testing
            cloudflared
          ];

          env.RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";

          shellHook = ''
            echo "Surgent development environment"
            echo "================================"
            echo "Bun: $(bun --version)"
            echo "Node: $(node --version)"
            echo "TypeScript: $(tsc --version)"
            echo "Rust (Cargo): $(cargo --version)"
            export NODE_ENV=development
          '';
        };
      }
    );
}
