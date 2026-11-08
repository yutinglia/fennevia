// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{Error, Result, discovery, paths};
use std::{
    io::{Read, Seek, SeekFrom},
    path::Path,
};

pub fn supported(root: &Path) -> Result<()> {
    let browser = discovery::firefox(&root.join("firefox.exe"))?;
    if browser
        .version
        .split('.')
        .next()
        .and_then(|v| v.parse::<u32>().ok())
        .is_none_or(|v| v < 153)
        || browser
            .version
            .split('.')
            .any(|v| v.is_empty() || !v.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err(Error::InvalidProgram);
    }
    let path = root.join("firefox.exe");
    let mut held = crate::handles::HeldFile::open(&path, false, false)?;
    let mut dos = [0u8; 64];
    held.0.read_exact(&mut dos)?;
    if &dos[..2] != b"MZ" {
        return Err(Error::InvalidProgram);
    }
    let offset = u32::from_le_bytes(dos[60..64].try_into().map_err(|_| Error::InvalidProgram)?);
    if !(64..=1024 * 1024).contains(&offset) {
        return Err(Error::InvalidProgram);
    }
    held.0.seek(SeekFrom::Start(offset.into()))?;
    let mut pe = [0u8; 6];
    held.0.read_exact(&mut pe)?;
    if &pe[..4] != b"PE\0\0" || u16::from_le_bytes([pe[4], pe[5]]) != 0x8664 {
        return Err(Error::UnsupportedPlatform);
    }
    let bytes = paths::bounded_read(&root.join("defaults/pref/channel-prefs.js"), 64 * 1024)?;
    let text = std::str::from_utf8(&bytes).map_err(|_| Error::InvalidProgram)?;
    // This file has one pref after the MPL comment. Do not evaluate JavaScript.
    let statements: Vec<_> = text
        .lines()
        .map(str::trim)
        .filter(|line| line.starts_with("pref("))
        .collect();
    if statements != ["pref(\"app.update.channel\", \"release\");"] {
        return Err(Error::InvalidProgram);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unsupported_architecture_channel_and_versions() {
        let temp = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let root = std::path::PathBuf::from(temp.to_str().unwrap().trim_start_matches(r"\\?\"))
            .join(format!("fennevia-browser-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("defaults/pref")).unwrap();
        let mut exe = vec![0; 70];
        exe[..2].copy_from_slice(b"MZ");
        exe[60..64].copy_from_slice(&64u32.to_le_bytes());
        exe[64..68].copy_from_slice(b"PE\0\0");
        exe[68..70].copy_from_slice(&0x8664u16.to_le_bytes());
        std::fs::write(root.join("firefox.exe"), &exe).unwrap();
        std::fs::write(
            root.join("defaults/pref/channel-prefs.js"),
            "pref(\"app.update.channel\", \"release\");\n",
        )
        .unwrap();
        for (version, valid) in [
            ("157.0", true),
            ("153.0.4", true),
            ("158.0", true),
            ("152.0", false),
            ("157.0esr", false),
            ("157.0b1", false),
        ] {
            std::fs::write(
                root.join("application.ini"),
                format!("[App]\nName=Firefox\nVersion={version}\nBuildID=20260924084938\n"),
            )
            .unwrap();
            assert_eq!(supported(&root).is_ok(), valid, "{version}");
        }
        std::fs::write(
            root.join("application.ini"),
            "[App]\nName=Firefox\nVersion=157.0\nBuildID=20260924084938\n",
        )
        .unwrap();
        exe[68..70].copy_from_slice(&0x14cu16.to_le_bytes());
        std::fs::write(root.join("firefox.exe"), &exe).unwrap();
        assert_eq!(supported(&root), Err(Error::UnsupportedPlatform));
        exe[68..70].copy_from_slice(&0x8664u16.to_le_bytes());
        std::fs::write(root.join("firefox.exe"), &exe).unwrap();
        for channel in ["beta", "esr", "nightly"] {
            std::fs::write(
                root.join("defaults/pref/channel-prefs.js"),
                format!("pref(\"app.update.channel\", \"{channel}\");\n"),
            )
            .unwrap();
            assert_eq!(supported(&root), Err(Error::InvalidProgram));
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}
