## Rust + WASM local development

This project uses a small Rust engine (`rust-engine`) compiled to WebAssembly and emitted to `src/gen`.

Quick setup (one-time):

- Install Rust toolchain (see https://rustup.rs) — on macOS/Linux:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- On Windows use the installer at https://rustup.rs or package managers (e.g. `winget` / `choco`).

- Install `cargo-watch` and the `wasm-pack` tool:

```bash
cargo install cargo-watch --locked
cargo install wasm-pack
```

- Verify `wasm-pack` is available:

```bash
wasm-pack --version
# or
npm run check:wasm-pack
```

Start dev server with live WASM rebuilds:

```bash
npm ci
npm run dev
```

> Note: If you encounter an "Unsupported platform" error during `npm install` (for example on Windows ARM64), installing `wasm-pack` via `cargo install wasm-pack` or using an x64 environment (WSL/x64, VM) avoids the failing npm postinstall that attempts to download a prebuilt binary.

What that does:

- `dev` runs `concurrently` which starts `cargo watch` to rebuild the WASM into `src/gen` on Rust changes, and runs `vite` for the web dev server.
- Generated files live in `src/gen` and are gitignored.

If you prefer manual build:

```bash
npm run build:wasm
npm run dev
```

Notes:

- If you don't want to install `cargo-watch`, you can run `npm run build:wasm` manually when you change Rust code.
- On CI we already install the Rust toolchain and build the WASM before building the site.
