// SPDX-License-Identifier: MPL-2.0
use crate::targets::{self, Session};
use fennevia_installer_core::{Error, Result, planning::Preview};
use fennevia_platform_windows::{
    transaction::{Outcome, Phase, Progress},
    transport,
    worker::{self, Request},
};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub fn worker_smoke() -> Result<()> {
    let nonce = Uuid::new_v4();
    let root = fennevia_platform_windows::security::current_image()?
        .parent()
        .ok_or(Error::InvalidPath)?
        .join(format!("missing-{nonce}"));
    let request = Request {
        target_identity: "a".repeat(64),
        default_confirmed: false,
        schema_version: 1,
        nonce,
        created: worker::now()?,
        user_sid: fennevia_platform_windows::security::user_sid()?,
        program: root.join("Firefox"),
        profile: root.join("Profile"),
        source: None,
        action: fennevia_installer_core::planning::Action::Uninstall,
        installation_id: Uuid::new_v4(),
        digest: String::new(),
    };
    match transport::launch(
        &request,
        false,
        option_env!("FENNEVIA_WORKER_SHA256"),
        |_| {},
    ) {
        Err(Error::Missing) => Ok(()),
        Err(error) => Err(error),
        Ok(_) => Err(Error::Io),
    }
}

#[derive(Default)]
pub struct Execution {
    pub generation: Uuid,
    pub busy: bool,
    pub uncertain: bool,
    progress: Arc<Mutex<Option<Progress>>>,
    pending: Option<(Uuid, Request, bool)>,
}
impl Execution {
    pub fn invalidate(&mut self) {
        self.generation = Uuid::new_v4();
        self.pending = None;
    }
    pub fn prepare(&mut self, request: Request) -> Uuid {
        let token = Uuid::new_v4();
        self.pending = Some((token, request, false));
        token
    }
    fn take(&mut self, token: Uuid, digest: &str, elevate: bool) -> Result<Request> {
        let (expected, request, allowed) = self.pending.take().ok_or(Error::Stale)?;
        if token != expected || request.digest != digest || elevate != allowed {
            return Err(Error::Stale);
        }
        request.validate()?;
        Ok(request)
    }
}
#[derive(Serialize)]
pub struct Review {
    #[serde(flatten)]
    pub preview: Preview,
    pub approval: Option<Uuid>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Applied {
    pub outcome: Outcome,
    pub elevation_approval: Option<Uuid>,
}
#[tauri::command]
pub fn installation_progress(state: tauri::State<'_, Mutex<Session>>) -> Result<Option<Progress>> {
    let session = state.lock().map_err(|_| Error::Busy)?;
    let progress = session
        .execution
        .progress
        .lock()
        .map_err(|_| Error::Busy)?
        .clone();
    Ok(progress)
}
#[tauri::command]
pub async fn apply_action(
    approval: Uuid,
    digest: String,
    confirmed: bool,
    elevate: bool,
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<Applied> {
    if !confirmed {
        return Err(Error::Cancelled);
    }
    let (request, progress) = {
        let mut session = targets::lock(&state)?;
        let request = session.execution.take(approval, &digest, elevate)?;
        session.execution.busy = true;
        let progress = session.execution.progress.clone();
        *progress.lock().map_err(|_| Error::Busy)? = Some(Progress {
            phase: Phase::Preparing,
            completed: 0,
            total: 0,
        });
        (request, progress)
    };
    let retained = request.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        // Preflight without elevation. A retry token is issued only after the
        // normal worker reports a clean rollback and program access is denied.
        let outcome = transport::launch(
            &request,
            elevate,
            option_env!("FENNEVIA_WORKER_SHA256"),
            move |update| {
                if let Ok(mut current) = progress.lock() {
                    *current = Some(update);
                }
            },
        )?;
        let retry = !elevate
            && outcome.state == "rolledBack"
            && outcome.error == Some(Error::AccessDenied)
            && worker::program_writable(&request) == Err(Error::AccessDenied);
        Ok((outcome, retry))
    })
    .await
    .map_err(|_| Error::Io)
    .and_then(|value: Result<_>| value);
    let mut session = state.lock().map_err(|_| Error::Busy)?;
    session.execution.busy = false;
    match result {
        Ok((outcome, retry)) => {
            let approval = if retry {
                let token = Uuid::new_v4();
                session.execution.pending = Some((token, retained, true));
                Some(token)
            } else {
                None
            };
            Ok(Applied {
                outcome,
                elevation_approval: approval,
            })
        }
        Err(error) => {
            // An IPC failure is not proof that the transaction failed. Prevent
            // retry in this session; inspect the target state after reopening.
            session.execution.uncertain = matches!(
                error,
                Error::Io
                    | Error::UnknownOutcome
                    | Error::Timeout
                    | Error::RollbackIncomplete
                    | Error::CommittedCleanup
                    | Error::Cleanup
            );
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request() -> Request {
        Request {
            target_identity: "a".repeat(64),
            default_confirmed: false,
            schema_version: 1,
            nonce: Uuid::new_v4(),
            created: worker::now().unwrap(),
            user_sid: fennevia_platform_windows::security::user_sid().unwrap(),
            program: "C:/fixture/Firefox".into(),
            profile: "C:/fixture/Profile".into(),
            source: None,
            action: fennevia_installer_core::planning::Action::Uninstall,
            installation_id: Uuid::new_v4(),
            digest: "a".repeat(64),
        }
    }
    #[test]
    fn consent_is_single_use_bound_and_invalidated() {
        let mut execution = Execution::default();
        let token = execution.prepare(request());
        assert!(execution.take(token, &"a".repeat(64), false).is_ok());
        assert!(matches!(
            execution.take(token, &"a".repeat(64), false),
            Err(Error::Stale)
        ));
        let token = execution.prepare(request());
        assert!(matches!(
            execution.take(token, &"b".repeat(64), false),
            Err(Error::Stale)
        ));
        let token = execution.prepare(request());
        assert!(matches!(
            execution.take(token, &"a".repeat(64), true),
            Err(Error::Stale)
        ));
        let token = execution.prepare(request());
        execution.invalidate();
        assert!(matches!(
            execution.take(token, &"a".repeat(64), false),
            Err(Error::Stale)
        ));
    }
}
