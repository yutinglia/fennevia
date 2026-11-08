// SPDX-License-Identifier: MPL-2.0
use serde::{Deserialize, Serialize};

/// Only closed, path-free codes may cross the UI/diagnostic boundary.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Error {
    InvalidPath,
    UnsafeRoot,
    ReparsePoint,
    Missing,
    AccessDenied,
    InvalidData,
    LimitExceeded,
    InvalidProgram,
    InvalidProfile,
    UnregisteredProfile,
    OverlappingRoots,
    Conflict,
    Stale,
    Busy,
    Io,
    Cleanup,
    UnsupportedPlatform,
    Cancelled,
    Permission,
    RollbackIncomplete,
    CommittedCleanup,
    Timeout,
    DevelopmentOnly,
    UnknownOutcome,
}
pub type Result<T> = std::result::Result<T, Error>;
impl From<std::io::Error> for Error {
    fn from(value: std::io::Error) -> Self {
        match value.kind() {
            std::io::ErrorKind::NotFound => Self::Missing,
            std::io::ErrorKind::PermissionDenied => Self::AccessDenied,
            std::io::ErrorKind::AlreadyExists => Self::Conflict,
            _ => Self::Io,
        }
    }
}
impl From<serde_json::Error> for Error {
    fn from(_: serde_json::Error) -> Self {
        Self::InvalidData
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for Error {}
