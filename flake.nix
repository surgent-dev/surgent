{
  description = "Surgent development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Primary runtimes
            bun
            nodejs_20
            typescript

            # Build tools
            turbo

            # System utilities
            unzip

            # Database
            postgresql_18

            # Optional dev tools
            nodePackages.typescript-language-server
            nodePackages.prettier
          ];

          shellHook = ''
            echo "Surgent development environment"
            echo "================================"
            echo "Bun: $(bun --version)"
            echo "Node: $(node --version)"
            echo "TypeScript: $(tsc --version)"
            echo ""
            export NODE_ENV=development
            export SHELL=${pkgs.zsh}/bin/zsh
            exec $SHELL
          '';
        };
      }
    );
}
