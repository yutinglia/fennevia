// SPDX-License-Identifier: MPL-2.0
#[cfg(windows)]
pub mod firefox;
#[cfg(windows)]
pub mod handles;
#[cfg(windows)]
pub mod preferences;
#[cfg(windows)]
pub mod registry;
#[cfg(windows)]
pub mod security;
#[cfg(windows)]
pub mod transaction;
#[cfg(windows)]
pub mod transport;
#[cfg(windows)]
pub mod worker;
