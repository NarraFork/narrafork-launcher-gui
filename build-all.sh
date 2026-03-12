#!/usr/bin/env bash
# NarraFork Launcher - Cross-platform build script
# Usage: ./build-all.sh [target...]
# Examples:
#   ./build-all.sh                    # Build for current platform
#   ./build-all.sh windows            # Build for Windows only
#   ./build-all.sh macos linux        # Build for macOS and Linux
#   ./build-all.sh all                # Build for all platforms (requires cross-compilation support)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Detect current platform
detect_platform() {
  case "$(uname -s)" in
    Darwin)  echo "macos" ;;
    Linux)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

# Detect current architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *)             echo "unknown" ;;
  esac
}

CURRENT_PLATFORM=$(detect_platform)
CURRENT_ARCH=$(detect_arch)

# Target map: platform -> rust target
get_rust_target() {
  case "$1" in
    windows-x64)    echo "x86_64-pc-windows-msvc" ;;
    macos-x64)      echo "x86_64-apple-darwin" ;;
    macos-arm64)    echo "aarch64-apple-darwin" ;;
    linux-x64)      echo "x86_64-unknown-linux-gnu" ;;
    linux-arm64)    echo "aarch64-unknown-linux-gnu" ;;
    *)              echo "" ;;
  esac
}

# Build for a specific target
build_target() {
  local target_name="$1"
  local rust_target
  rust_target=$(get_rust_target "$target_name")

  if [ -z "$rust_target" ]; then
    error "Unknown target: $target_name"
    return 1
  fi

  info "Building for $target_name ($rust_target)..."

  # Check if rust target is installed
  if ! rustup target list --installed | grep -q "$rust_target"; then
    info "Installing Rust target: $rust_target"
    rustup target add "$rust_target"
  fi

  pnpm tauri build --target "$rust_target"

  info "Build complete for $target_name"
  info "Output: src-tauri/target/$rust_target/release/bundle/"
}

# Install frontend dependencies
install_deps() {
  info "Installing frontend dependencies..."
  pnpm install
}

# Main
main() {
  local targets=()

  if [ $# -eq 0 ]; then
    # Default: build for current platform
    targets=("${CURRENT_PLATFORM}-${CURRENT_ARCH}")
    info "No target specified, building for current platform: ${targets[0]}"
  elif [ "$1" = "all" ]; then
    # Build all (note: cross-compilation may not work for all targets)
    if [ "$CURRENT_PLATFORM" = "macos" ]; then
      targets=("macos-arm64" "macos-x64")
      warn "Cross-compiling to Windows/Linux from macOS is not supported by Tauri."
      warn "Use GitHub Actions (build.yml) for full cross-platform builds."
    elif [ "$CURRENT_PLATFORM" = "linux" ]; then
      targets=("linux-x64")
      warn "Cross-compiling to Windows/macOS from Linux is not supported by Tauri."
      warn "Use GitHub Actions (build.yml) for full cross-platform builds."
    elif [ "$CURRENT_PLATFORM" = "windows" ]; then
      targets=("windows-x64")
      warn "Cross-compiling to macOS/Linux from Windows is not supported by Tauri."
      warn "Use GitHub Actions (build.yml) for full cross-platform builds."
    fi
  else
    # Build specified targets
    for arg in "$@"; do
      case "$arg" in
        windows) targets+=("windows-x64") ;;
        macos)   targets+=("macos-arm64" "macos-x64") ;;
        linux)   targets+=("linux-x64") ;;
        *)       targets+=("$arg") ;;
      esac
    done
  fi

  install_deps

  local success=0
  local fail=0

  for target in "${targets[@]}"; do
    if build_target "$target"; then
      ((success++))
    else
      ((fail++))
      error "Failed to build for $target"
    fi
  done

  echo ""
  info "==============================="
  info "Build Summary"
  info "  Success: $success"
  [ "$fail" -gt 0 ] && error "  Failed:  $fail"
  info "==============================="
  info "Build artifacts: src-tauri/target/*/release/bundle/"
}

main "$@"
