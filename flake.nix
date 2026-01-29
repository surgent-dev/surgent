{
  description = "Surgent development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-master.url = "github:NixOS/nixpkgs/master";
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
      nixpkgs-master,
      flake-utils,
      fenix,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        pkgs-master = import nixpkgs-master {
          inherit system;
        };
        fenixLib = fenix.packages.${system};
        rustToolchain = fenixLib.stable.toolchain;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Primary runtimes
            pkgs-master.bun # pinned to master for latest version
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
          env.LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.openssl ];

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
