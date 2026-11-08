// SPDX-License-Identifier: MPL-2.0
use crate::security::wide;
use fennevia_installer_core::{Error, Result, paths};
use std::{
    fs::{File, OpenOptions},
    io::{Read, Seek, SeekFrom},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    path::{Path, PathBuf},
    ptr,
};
use windows_sys::Win32::{Foundation::*, Storage::FileSystem::*};
use windows_sys::{
    Wdk::Storage::FileSystem::{
        FILE_RENAME_INFORMATION, FileRenameInformation, NtSetInformationFile,
    },
    Win32::System::IO::IO_STATUS_BLOCK,
};

pub struct HeldFile(pub File);
impl HeldFile {
    pub fn identity(&self) -> Result<String> {
        let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
        if unsafe { GetFileInformationByHandle(self.0.as_raw_handle(), &mut info) } == 0 {
            return Err(Error::Io);
        }
        Ok(format!(
            "{:08x}:{:08x}{:08x}",
            info.dwVolumeSerialNumber, info.nFileIndexHigh, info.nFileIndexLow
        ))
    }
    pub fn open(path: &Path, directory: bool, movable: bool) -> Result<Self> {
        paths::no_reparse(path)?;
        let file = OpenOptions::new()
            .access_mode(GENERIC_READ | if movable { DELETE } else { 0 })
            .share_mode(FILE_SHARE_READ | if directory { FILE_SHARE_WRITE } else { 0 })
            .custom_flags(
                FILE_FLAG_OPEN_REPARSE_POINT
                    | if directory {
                        FILE_FLAG_BACKUP_SEMANTICS
                    } else {
                        0
                    },
            )
            .open(path)?;
        let held = Self(file);
        held.validate(path, directory, movable)?;
        Ok(held)
    }
    pub(crate) fn validate(&self, path: &Path, directory: bool, reject_links: bool) -> Result<()> {
        unsafe {
            let mut info: BY_HANDLE_FILE_INFORMATION = std::mem::zeroed();
            if GetFileInformationByHandle(self.0.as_raw_handle(), &mut info) == 0 {
                return Err(Error::Io);
            }
            if info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
                || (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY != 0) != directory
                || (!directory && reject_links && info.nNumberOfLinks != 1)
            {
                return Err(Error::InvalidPath);
            }
            let mut final_name = vec![0u16; 32768];
            let len = GetFinalPathNameByHandleW(
                self.0.as_raw_handle(),
                final_name.as_mut_ptr(),
                final_name.len() as u32,
                FILE_NAME_NORMALIZED | VOLUME_NAME_DOS,
            );
            if len == 0 || len as usize >= final_name.len() {
                return Err(Error::InvalidPath);
            }
            let name =
                String::from_utf16(&final_name[..len as usize]).map_err(|_| Error::InvalidPath)?;
            let name = name.strip_prefix(r"\\?\").ok_or(Error::InvalidPath)?;
            // Reject aliases (short names, substituted drives) as well as redirection.
            if !paths::same(Path::new(name), path) {
                return Err(Error::InvalidPath);
            }
        }
        Ok(())
    }
    pub fn create(path: &Path, directory: bool, private: bool) -> Result<Self> {
        use std::os::windows::io::FromRawHandle;
        use windows_sys::Wdk::{
            Foundation::OBJECT_ATTRIBUTES,
            Storage::FileSystem::{
                FILE_CREATE, FILE_DIRECTORY_FILE, FILE_NON_DIRECTORY_FILE, FILE_OPEN_REPARSE_POINT,
                FILE_SYNCHRONOUS_IO_NONALERT, NtCreateFile,
            },
        };
        let parent = Self::open(path.parent().ok_or(Error::InvalidPath)?, true, false)?;
        let mut name = wide(path.file_name().ok_or(Error::InvalidPath)?);
        if name.len() * 2 > u16::MAX as usize {
            return Err(Error::LimitExceeded);
        }
        let mut unicode = UNICODE_STRING {
            Length: ((name.len() - 1) * 2) as u16,
            MaximumLength: (name.len() * 2) as u16,
            Buffer: name.as_mut_ptr(),
        };
        let descriptor = if private {
            Some(crate::security::descriptor()?)
        } else {
            None
        };
        let attributes = OBJECT_ATTRIBUTES {
            Length: size_of::<OBJECT_ATTRIBUTES>() as u32,
            RootDirectory: parent.0.as_raw_handle(),
            ObjectName: &mut unicode,
            Attributes: 0,
            SecurityDescriptor: descriptor.as_ref().map_or(ptr::null(), |d| d.0.cast()),
            SecurityQualityOfService: ptr::null_mut(),
        };
        let mut raw = ptr::null_mut();
        let mut status: IO_STATUS_BLOCK = unsafe { std::mem::zeroed() };
        let code = unsafe {
            NtCreateFile(
                &mut raw,
                GENERIC_READ | GENERIC_WRITE | DELETE | SYNCHRONIZE,
                &attributes,
                &mut status,
                ptr::null(),
                FILE_ATTRIBUTE_NORMAL,
                FILE_SHARE_READ,
                FILE_CREATE,
                FILE_SYNCHRONOUS_IO_NONALERT
                    | FILE_OPEN_REPARSE_POINT
                    | if directory {
                        FILE_DIRECTORY_FILE
                    } else {
                        FILE_NON_DIRECTORY_FILE
                    },
                ptr::null(),
                0,
            )
        };
        if code < 0 {
            return Err(std::io::Error::from_raw_os_error(
                unsafe { RtlNtStatusToDosError(code) } as i32
            )
            .into());
        }
        let held = Self(unsafe { File::from_raw_handle(raw) });
        if let Err(error) = held.validate(path, directory, true) {
            held.remove()?;
            return Err(error);
        }
        Ok(held)
    }
    pub fn bytes(&mut self, limit: u64) -> Result<Vec<u8>> {
        if self.0.metadata()?.len() > limit {
            return Err(Error::LimitExceeded);
        }
        self.0.seek(SeekFrom::Start(0))?;
        let mut bytes = Vec::new();
        (&mut self.0).take(limit + 1).read_to_end(&mut bytes)?;
        if bytes.len() as u64 > limit {
            return Err(Error::LimitExceeded);
        }
        Ok(bytes)
    }
    pub fn rename(&self, destination: &Path) -> Result<()> {
        paths::no_reparse(destination)?;
        let parent = HeldFile::open(destination.parent().ok_or(Error::InvalidPath)?, true, false)?;
        let name = wide(destination.file_name().ok_or(Error::InvalidPath)?);
        let offset = std::mem::offset_of!(FILE_RENAME_INFORMATION, FileName);
        let length = (offset + name.len() * 2).max(size_of::<FILE_RENAME_INFORMATION>());
        let mut aligned = vec![0usize; length.div_ceil(size_of::<usize>())];
        unsafe {
            let info = aligned.as_mut_ptr().cast::<FILE_RENAME_INFORMATION>();
            (*info).Anonymous.ReplaceIfExists = false;
            (*info).RootDirectory = parent.0.as_raw_handle();
            (*info).FileNameLength = ((name.len() - 1) * 2) as u32;
            ptr::copy_nonoverlapping(name.as_ptr(), (*info).FileName.as_mut_ptr(), name.len());
            let mut status: IO_STATUS_BLOCK = std::mem::zeroed();
            let code = NtSetInformationFile(
                self.0.as_raw_handle(),
                &mut status,
                info.cast(),
                length as u32,
                FileRenameInformation,
            );
            if code < 0 {
                return Err(
                    std::io::Error::from_raw_os_error(RtlNtStatusToDosError(code) as i32).into(),
                );
            }
        }
        Ok(())
    }
    pub fn remove(self) -> Result<()> {
        unsafe {
            let info = FILE_DISPOSITION_INFO { DeleteFile: true };
            if SetFileInformationByHandle(
                self.0.as_raw_handle(),
                FileDispositionInfo,
                ptr::addr_of!(info).cast(),
                size_of::<FILE_DISPOSITION_INFO>() as u32,
            ) == 0
            {
                return Err(std::io::Error::last_os_error().into());
            }
        }
        Ok(())
    }
}

/// Keep every existing ancestor pinned against rename. Operations also validate
/// final handle paths and address new entries relative to an opened parent.
pub struct DirectoryPins {
    entries: Vec<(PathBuf, HeldFile)>,
}
impl Default for DirectoryPins {
    fn default() -> Self {
        Self::new()
    }
}
impl DirectoryPins {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }
    pub fn pin(&mut self, path: &Path) -> Result<()> {
        let mut chain: Vec<_> = path.ancestors().collect();
        chain.reverse();
        for path in chain {
            if self.entries.iter().any(|(p, _)| paths::same(p, path)) {
                continue;
            }
            if !path.try_exists()? {
                break;
            }
            let handle = HeldFile::open(path, true, false)?;
            paths::no_reparse(path)?;
            self.entries.push((path.to_owned(), handle));
        }
        Ok(())
    }
    pub fn release(&mut self, path: &Path) {
        self.entries.retain(|(p, _)| !paths::same(p, path));
    }
}
