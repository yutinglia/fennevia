// SPDX-License-Identifier: MPL-2.0
use serde::Deserialize;
use std::io::{self, Read};

#[derive(Deserialize)]
#[serde(tag = "operation", rename_all = "camelCase", deny_unknown_fields)]
enum Request {
    Probe { nonce: String },
}

fn main() {
    let result = run();
    if result.is_err() {
        eprintln!("FENNEVIA_WORKER_REQUEST_REJECTED");
        std::process::exit(1);
    }
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() == 2 && args[0] == "--pipe" {
        let image = fennevia_platform_windows::security::current_image()?;
        let root = image.parent().ok_or("missing parent")?;
        if !cfg!(debug_assertions) || root.join("INSTALLER-MANIFEST.json").exists() {
            fennevia_installer_core::distribution::validate(root)?;
        }
        let nonce = uuid::Uuid::parse_str(&args[1])?;
        fennevia_platform_windows::transport::serve(nonce)?;
        return Ok(());
    }
    if std::env::args_os().len() != 1 {
        return Err("arguments rejected".into());
    }
    let mut bytes = Vec::new();
    io::stdin().take(4097).read_to_end(&mut bytes)?;
    if bytes.len() > 4096 {
        return Err("size rejected".into());
    }
    match serde_json::from_slice::<Request>(&bytes)? {
        Request::Probe { nonce } => {
            if nonce.len() != 32 || !nonce.bytes().all(|c| c.is_ascii_hexdigit()) {
                return Err("nonce rejected".into());
            }
            println!(
                "{}",
                serde_json::json!({"schemaVersion":1,"nonce":nonce,"status":"ready","mutates":false})
            );
        }
    }
    Ok(())
}
