// SPDX-License-Identifier: MPL-2.0
//! One-shot, local-only, SID-restricted named pipe. No target paths in argv.
use crate::{
    handles::HeldFile,
    security::{self, Handle, wide},
    transaction::{Outcome, Progress},
    worker::{self, Request},
};
use fennevia_installer_core::{Error, Result, paths};
use serde::{Deserialize, Serialize};
use std::{
    os::windows::process::CommandExt,
    path::PathBuf,
    ptr,
    time::{Duration, Instant},
};
use uuid::Uuid;
use windows_sys::Win32::{
    Foundation::*,
    Security::*,
    Storage::FileSystem::*,
    System::{Pipes::*, Threading::*},
    UI::{Shell::*, WindowsAndMessaging::SW_HIDE},
};
const LIMIT: usize = 64 * 1024;
fn name(nonce: Uuid) -> Vec<u16> {
    wide(std::ffi::OsStr::new(&format!(
        r"\\.\pipe\Fennevia.Setup.{}",
        nonce.simple()
    )))
}
fn process(pid: u32) -> Result<Handle> {
    let raw = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, 0, pid) };
    if raw.is_null() {
        Err(Error::Permission)
    } else {
        Ok(Handle(raw))
    }
}
fn image_path(process: &Handle) -> Result<PathBuf> {
    let mut value = vec![0u16; 32768];
    let mut size = value.len() as u32;
    if unsafe { QueryFullProcessImageNameW(process.0, 0, value.as_mut_ptr(), &mut size) } == 0 {
        return Err(Error::Permission);
    }
    paths::absolute(&String::from_utf16(&value[..size as usize]).map_err(|_| Error::InvalidPath)?)
}
fn peer(pid: u32, expected: &std::path::Path) -> Result<()> {
    let handle = process(pid)?;
    if security::process_sid(handle.0)? != security::user_sid()?
        || !paths::same(&image_path(&handle)?, expected)
    {
        return Err(Error::Permission);
    }
    Ok(())
}
fn write(pipe: &Handle, bytes: &[u8]) -> Result<()> {
    if bytes.is_empty() || bytes.len() > LIMIT {
        return Err(Error::LimitExceeded);
    }
    let mut done = 0;
    if unsafe {
        WriteFile(
            pipe.0,
            bytes.as_ptr(),
            bytes.len() as u32,
            &mut done,
            ptr::null_mut(),
        )
    } == 0
        || done as usize != bytes.len()
    {
        return Err(Error::Io);
    }
    Ok(())
}
fn read(pipe: &Handle, deadline: Instant) -> Result<Vec<u8>> {
    let mut bytes = vec![0; LIMIT + 1];
    loop {
        let mut done = 0;
        if unsafe {
            ReadFile(
                pipe.0,
                bytes.as_mut_ptr(),
                bytes.len() as u32,
                &mut done,
                ptr::null_mut(),
            )
        } != 0
        {
            if done as usize > LIMIT {
                return Err(Error::LimitExceeded);
            }
            bytes.truncate(done as usize);
            return Ok(bytes);
        }
        let code = unsafe { GetLastError() };
        if code != ERROR_NO_DATA {
            return Err(if code == ERROR_MORE_DATA {
                Error::LimitExceeded
            } else {
                Error::Io
            });
        }
        if Instant::now() >= deadline {
            return Err(Error::Timeout);
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Reply {
    nonce: Uuid,
    complete: bool,
    result: std::result::Result<Outcome, Error>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Ack {
    nonce: Uuid,
}
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
enum Message {
    Reply(Reply),
    Progress { nonce: Uuid, progress: Progress },
}

pub fn launch(
    request: &Request,
    elevate: bool,
    expected_worker_hash: Option<&str>,
    mut progress: impl FnMut(Progress),
) -> Result<Outcome> {
    request.validate()?;
    let gui = security::current_image()?;
    let worker = gui.with_file_name("fennevia-installer-worker.exe");
    // Keep both images immutable for the entire connection and transaction.
    let mut worker_image = HeldFile::open(&worker, false, false)?;
    match expected_worker_hash {
        Some(expected) if paths::hash(&worker_image.bytes(128 * 1024 * 1024)?) == expected => {}
        None if cfg!(debug_assertions) => {}
        _ => return Err(Error::Conflict),
    }
    let _gui_image = HeldFile::open(&gui, false, false)?;
    let descriptor = security::descriptor()?;
    let attributes = SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor.0,
        bInheritHandle: 0,
    };
    let raw = unsafe {
        CreateNamedPipeW(
            name(request.nonce).as_ptr(),
            PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_NOWAIT | PIPE_REJECT_REMOTE_CLIENTS,
            1,
            (LIMIT + 1) as u32,
            (LIMIT + 1) as u32,
            0,
            &attributes,
        )
    };
    if raw == INVALID_HANDLE_VALUE {
        return Err(Error::Permission);
    }
    let pipe = Handle(raw);
    let arguments = format!("--pipe {}", request.nonce.simple());
    let child = if elevate {
        let verb = wide(std::ffi::OsStr::new("runas"));
        let exe = wide(worker.as_os_str());
        let args = wide(std::ffi::OsStr::new(&arguments));
        let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        info.cbSize = size_of::<SHELLEXECUTEINFOW>() as u32;
        info.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC;
        info.lpVerb = verb.as_ptr();
        info.lpFile = exe.as_ptr();
        info.lpParameters = args.as_ptr();
        info.nShow = SW_HIDE;
        if unsafe { ShellExecuteExW(&mut info) } == 0 {
            return Err(if unsafe { GetLastError() } == ERROR_CANCELLED {
                Error::Cancelled
            } else {
                Error::Permission
            });
        }
        if info.hProcess.is_null() {
            return Err(Error::Permission);
        }
        Handle(info.hProcess)
    } else {
        let spawned = std::process::Command::new(&worker)
            .args(["--pipe", &request.nonce.simple().to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()?;
        process(spawned.id())?
    };
    let pid = unsafe { GetProcessId(child.0) };
    let deadline = Instant::now() + Duration::from_secs(900);
    loop {
        let connected = unsafe { ConnectNamedPipe(pipe.0, ptr::null_mut()) };
        let error = unsafe { GetLastError() };
        if connected != 0 || error == ERROR_PIPE_CONNECTED {
            break;
        }
        if error != ERROR_PIPE_LISTENING && error != ERROR_NO_DATA {
            return Err(Error::Io);
        }
        if unsafe { WaitForSingleObject(child.0, 0) } == WAIT_OBJECT_0 {
            return Err(Error::Permission);
        }
        if Instant::now() >= deadline {
            return Err(Error::Timeout);
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let mut connected_pid = 0;
    if unsafe { GetNamedPipeClientProcessId(pipe.0, &mut connected_pid) } == 0
        || connected_pid != pid
    {
        return Err(Error::Permission);
    }
    peer(pid, &worker)?;
    write(&pipe, &serde_json::to_vec(request)?).map_err(|_| Error::UnknownOutcome)?;
    let mut receive = || -> Result<Reply> {
        loop {
            let message: Message =
                serde_json::from_slice(&read(&pipe, deadline).map_err(|_| Error::UnknownOutcome)?)
                    .map_err(|_| Error::UnknownOutcome)?;
            match message {
                Message::Reply(reply) => return Ok(reply),
                Message::Progress {
                    nonce,
                    progress: update,
                } => {
                    if nonce != request.nonce
                        || update.completed > update.total
                        || update.total > 65536
                    {
                        return Err(Error::UnknownOutcome);
                    }
                    progress(update);
                }
            }
        }
    };
    let mut reply = receive()?;
    if reply.nonce != request.nonce {
        return Err(Error::UnknownOutcome);
    }
    if !reply.complete {
        if reply.result.is_err() {
            return Err(Error::UnknownOutcome);
        }
        write(
            &pipe,
            &serde_json::to_vec(&Ack {
                nonce: request.nonce,
            })?,
        )
        .map_err(|_| Error::UnknownOutcome)?;
        reply = receive()?;
        if reply.nonce != request.nonce || !reply.complete {
            return Err(Error::UnknownOutcome);
        }
    }
    reply.result
}

pub fn serve(nonce: Uuid) -> Result<()> {
    if nonce.is_nil() {
        return Err(Error::InvalidData);
    }
    let own = security::current_image()?;
    let gui = own.with_file_name(
        if cfg!(debug_assertions) && !own.with_file_name("INSTALLER-MANIFEST.json").exists() {
            "fennevia-setup.exe"
        } else {
            "FenneviaSetup.exe"
        },
    );
    let _image = HeldFile::open(&own, false, false)?;
    let _gui = HeldFile::open(&gui, false, false)?;
    let raw = unsafe {
        CreateFileW(
            name(nonce).as_ptr(),
            GENERIC_READ | GENERIC_WRITE,
            0,
            ptr::null(),
            OPEN_EXISTING,
            SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION,
            ptr::null_mut(),
        )
    };
    if raw == INVALID_HANDLE_VALUE {
        return Err(Error::Permission);
    }
    let pipe = Handle(raw);
    let mode = PIPE_READMODE_MESSAGE | PIPE_NOWAIT;
    if unsafe { SetNamedPipeHandleState(pipe.0, &mode, ptr::null(), ptr::null()) } == 0 {
        return Err(Error::Io);
    }
    let mut pid = 0;
    if unsafe { GetNamedPipeServerProcessId(pipe.0, &mut pid) } == 0 {
        return Err(Error::Permission);
    }
    peer(pid, &gui)?;
    let deadline = Instant::now() + Duration::from_secs(900);
    let request: Request = serde_json::from_slice(&read(&pipe, deadline)?)?;
    if request.nonce != nonce {
        return Err(Error::Stale);
    }
    request.validate()?;
    // Once accepted, finish/rollback even if the original GUI disconnects.
    let result = worker::run_progress(
        &request,
        |outcome| {
            write(
                &pipe,
                &serde_json::to_vec(&Message::Reply(Reply {
                    nonce,
                    complete: false,
                    result: Ok(outcome.clone()),
                }))?,
            )?;
            let ack: Ack = serde_json::from_slice(&read(&pipe, deadline)?)?;
            if ack.nonce != nonce {
                return Err(Error::Stale);
            }
            Ok(())
        },
        |progress| {
            // Progress is advisory. A closed or full pipe must never interrupt undo.
            if let Ok(bytes) = serde_json::to_vec(&Message::Progress { nonce, progress }) {
                let _ = write(&pipe, &bytes);
            }
        },
    );
    write(
        &pipe,
        &serde_json::to_vec(&Message::Reply(Reply {
            nonce,
            complete: true,
            result,
        }))?,
    )
}
