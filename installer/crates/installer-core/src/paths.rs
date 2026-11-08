// SPDX-License-Identifier: MPL-2.0
use crate::{Error, Result};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
};

pub const MAX_TEXT: u64 = 16 * 1024 * 1024;
pub fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn bounded_read(path: &Path, limit: u64) -> Result<Vec<u8>> {
    no_reparse(path)?;
    let file = fs::File::open(path)?;
    let meta = file.metadata()?;
    if !meta.is_file() {
        return Err(Error::InvalidPath);
    }
    if meta.len() > limit {
        return Err(Error::LimitExceeded);
    }
    let mut bytes = Vec::new();
    file.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err(Error::LimitExceeded);
    }
    Ok(bytes)
}
pub fn text(path: &Path, limit: u64) -> Result<String> {
    let bytes = bounded_read(path, limit)?;
    let value = String::from_utf8(bytes).map_err(|_| Error::InvalidData)?;
    Ok(value.trim_start_matches('\u{feff}').to_owned())
}
pub fn no_reparse(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(meta) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if meta.file_attributes() & 0x400 != 0 {
                        return Err(Error::ReparsePoint);
                    }
                }
                if meta.file_type().is_symlink() {
                    return Err(Error::ReparsePoint);
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
    }
    Ok(())
}

/// Windows targets deliberately exclude UNC/device/ADS and ambiguous Win32 names.
pub fn absolute(value: &str) -> Result<PathBuf> {
    let path = absolute_syntax(value)?;
    no_reparse(&path)?;
    Ok(path)
}

/// Validate stored text without accessing a target which may have moved or changed.
pub fn absolute_syntax(value: &str) -> Result<PathBuf> {
    if value.is_empty()
        || value.len() > 32760
        || value.trim() != value
        || value
            .chars()
            .any(|c| c.is_control() || ['*', '?', '"', '<', '>', '|'].contains(&c))
    {
        return Err(Error::InvalidPath);
    }
    #[cfg(windows)]
    {
        let bytes = value.as_bytes();
        if bytes.len() < 3
            || !bytes[0].is_ascii_alphabetic()
            || bytes[1] != b':'
            || !matches!(bytes[2], b'\\' | b'/')
            || value[2..].contains(':')
        {
            return Err(Error::InvalidPath);
        }
        for part in value[3..].split(['/', '\\']).filter(|p| !p.is_empty()) {
            let base = part.split('.').next().unwrap_or("").to_ascii_uppercase();
            if part.ends_with(['.', ' '])
                || ["CON", "PRN", "AUX", "NUL"].contains(&base.as_str())
                || (base.len() == 4
                    && (base.starts_with("COM") || base.starts_with("LPT"))
                    && base.as_bytes()[3].is_ascii_digit())
            {
                return Err(Error::InvalidPath);
            }
        }
    }
    let path = PathBuf::from(value);
    if !path.is_absolute()
        || path
            .components()
            .any(|p| matches!(p, Component::ParentDir | Component::CurDir))
    {
        return Err(Error::InvalidPath);
    }
    // Do not resolve junctions before checking them. Keep a normal Win32 spelling.
    let normalized: PathBuf = path.components().collect();
    Ok(normalized)
}
pub fn key(path: &Path) -> String {
    let value = path.to_string_lossy().replace('\\', "/");
    #[cfg(windows)]
    {
        value.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        value
    }
}
pub fn same(a: &Path, b: &Path) -> bool {
    key(a) == key(b)
}
pub fn within(child: &Path, parent: &Path) -> bool {
    key(child).starts_with(&(key(parent).trim_end_matches('/').to_owned() + "/"))
}
pub fn relative(value: &str) -> Result<&str> {
    if value.is_empty()
        || value.len() > 1024
        || value.starts_with('/')
        || value.ends_with('/')
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._/-".contains(&b))
        || value
            .split('/')
            .any(|v| v.is_empty() || v == "." || v == ".." || v.ends_with('.') || reserved(v))
    {
        return Err(Error::InvalidPath);
    }
    Ok(value)
}
fn reserved(value: &str) -> bool {
    let base = value.split('.').next().unwrap_or("").to_ascii_uppercase();
    ["CON", "PRN", "AUX", "NUL"].contains(&base.as_str())
        || (base.len() == 4
            && (base.starts_with("COM") || base.starts_with("LPT"))
            && base.as_bytes()[3].is_ascii_digit())
}
pub fn join(root: &Path, relative_path: &str) -> Result<PathBuf> {
    relative(relative_path)?;
    let path = root.join(relative_path);
    if !within(&path, root) {
        return Err(Error::InvalidPath);
    }
    no_reparse(&path)?;
    Ok(path)
}
pub fn root_allowed(root: &Path, broad: &[PathBuf]) -> Result<()> {
    if root.parent().is_none() || broad.iter().any(|p| same(root, p)) {
        return Err(Error::UnsafeRoot);
    }
    if !root.is_dir() {
        return Err(Error::Missing);
    }
    no_reparse(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_traversal_and_ambiguous_manifest_paths() {
        for path in ["../a", "/a", "a//b", "a/./b", "a:b", "a\\b", "a."] {
            assert!(relative(path).is_err(), "{path}");
        }
        assert!(relative("chrome/fennevia/content/Bootstrap.sys.mjs").is_ok());
    }
    #[test]
    fn containment_is_component_bounded() {
        assert!(!within(
            Path::new("C:/profile-other"),
            Path::new("C:/profile")
        ));
        assert!(within(
            Path::new("C:/profile/chrome"),
            Path::new("C:/profile")
        ));
    }
    #[cfg(windows)]
    #[test]
    fn rejects_windows_device_stream_and_network_inputs() {
        for path in [
            "C:relative",
            "\\\\server\\profile",
            "C:/x:stream",
            "C:/a/../b",
            "C:/NUL",
            "C:/a.",
            "C:/x?",
        ] {
            assert!(absolute(path).is_err(), "{path}");
        }
    }
}
