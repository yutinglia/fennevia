// SPDX-License-Identifier: MPL-2.0
// Read-only build/release check; never prints local paths.
fn main() {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 1 {
        std::process::exit(2);
    }
    match fennevia_installer_core::distribution::validate(std::path::Path::new(&args[0])) {
        Ok(files) => println!("NATIVE_DISTRIBUTION_VALID files={}", files.len()),
        Err(error) => {
            eprintln!("NATIVE_DISTRIBUTION_REJECTED {error:?}");
            std::process::exit(1);
        }
    }
}
