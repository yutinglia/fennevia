// SPDX-License-Identifier: MPL-2.0
use std::{
    io::Write,
    process::{Command, Stdio},
};
fn run(input: &[u8], arguments: &[&str]) -> std::process::Output {
    let mut worker = Command::new(env!("CARGO_BIN_EXE_fennevia-installer-worker"))
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    if let Some(mut pipe) = worker.stdin.take() {
        let _ = pipe.write_all(input);
    }
    worker.wait_with_output().unwrap()
}
#[test]
fn bounded_probe_correlates_response_without_mutation() {
    let result = run(
        br#"{"operation":"probe","nonce":"0123456789abcdef0123456789abcdef"}"#,
        &[],
    );
    assert!(result.status.success());
    assert!(result.stderr.is_empty());
    let data: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(
        data,
        serde_json::json!({"schemaVersion": 1, "nonce": "0123456789abcdef0123456789abcdef", "status": "ready", "mutates": false})
    );
}
#[test]
fn worker_rejects_unknown_actions_fields_args_and_oversized_payloads() {
    for payload in [
        br#"{"operation":"install"}"#.as_slice(),
        br#"{"operation":"probe","nonce":"short"}"#,
        br#"{"operation":"probe","nonce":"0123456789abcdef0123456789abcdef","path":"private"}"#,
        &vec![b'a'; 4097],
    ] {
        let result = run(payload, &[]);
        assert!(!result.status.success());
        assert!(result.stdout.is_empty());
        assert_eq!(
            String::from_utf8(result.stderr).unwrap().trim(),
            "FENNEVIA_WORKER_REQUEST_REJECTED"
        );
    }
    assert!(!run(b"", &["--arbitrary-path"]).status.success());
}
