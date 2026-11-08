// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{Error, Result, paths};
use std::{
    ffi::c_void,
    fs::File,
    io::Write,
    os::windows::{ffi::OsStrExt, io::FromRawHandle},
    path::Path,
    ptr,
};
use windows_sys::Win32::System::SystemServices::ACCESS_ALLOWED_ACE_TYPE;
use windows_sys::Win32::{
    Foundation::*, Security::Authorization::*, Security::*, Storage::FileSystem::*,
    System::Threading::*,
};

pub fn wide(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}
/// Normalize only the trusted OS-provided image name, not renderer input.
pub fn current_image() -> Result<std::path::PathBuf> {
    let path = std::env::current_exe()?;
    let value = path.to_str().ok_or(Error::InvalidPath)?;
    paths::absolute(value.strip_prefix(r"\\?\").unwrap_or(value))
}
pub struct Handle(pub HANDLE);
/// A newly installed file inherits its final parent's ACL, never the private staging ACL.
/// Existing files are moved intact for undo and their ACLs are not rewritten.
pub fn inherit_file_permissions(path: &Path) -> Result<()> {
    use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
    paths::no_reparse(path)?;
    let file = std::fs::OpenOptions::new()
        .access_mode(READ_CONTROL | WRITE_DAC)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)?;
    unsafe {
        let mut acl: ACL = std::mem::zeroed();
        if InitializeAcl(&mut acl, size_of::<ACL>() as u32, ACL_REVISION) == 0
            || SetSecurityInfo(
                file.as_raw_handle(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION | UNPROTECTED_DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                &acl,
                ptr::null(),
            ) != ERROR_SUCCESS
        {
            return Err(Error::Permission);
        }
    }
    Ok(())
}
impl Drop for Handle {
    fn drop(&mut self) {
        if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}
unsafe impl Send for Handle {}

pub fn user_sid() -> Result<String> {
    process_sid(unsafe { GetCurrentProcess() })
}
pub(crate) fn process_sid(process: HANDLE) -> Result<String> {
    unsafe {
        let mut raw = ptr::null_mut();
        if OpenProcessToken(process, TOKEN_QUERY, &mut raw) == 0 {
            return Err(Error::Permission);
        }
        let token = Handle(raw);
        let mut size = 0;
        GetTokenInformation(token.0, TokenUser, ptr::null_mut(), 0, &mut size);
        if size == 0 || size > 65536 {
            return Err(Error::Permission);
        }
        let mut storage = vec![0usize; (size as usize).div_ceil(size_of::<usize>())];
        if GetTokenInformation(
            token.0,
            TokenUser,
            storage.as_mut_ptr().cast(),
            size,
            &mut size,
        ) == 0
        {
            return Err(Error::Permission);
        }
        let user = &*storage.as_ptr().cast::<TOKEN_USER>();
        sid_string(user.User.Sid)
    }
}

/// The GUI must never host an elevated WebView. Only the native worker may elevate.
pub fn is_elevated() -> Result<bool> {
    unsafe {
        let mut raw = ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut raw) == 0 {
            return Err(Error::Permission);
        }
        let token = Handle(raw);
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut size = 0;
        if GetTokenInformation(
            token.0,
            TokenElevation,
            ptr::addr_of_mut!(elevation).cast(),
            size_of::<TOKEN_ELEVATION>() as u32,
            &mut size,
        ) == 0
        {
            return Err(Error::Permission);
        }
        Ok(elevation.TokenIsElevated != 0)
    }
}
unsafe fn sid_string(sid: PSID) -> Result<String> {
    unsafe {
        let mut string = ptr::null_mut();
        if ConvertSidToStringSidW(sid, &mut string) == 0 {
            return Err(Error::Permission);
        }
        let mut len = 0;
        while len < 256 && *string.add(len) != 0 {
            len += 1;
        }
        let result = String::from_utf16(std::slice::from_raw_parts(string, len))
            .map_err(|_| Error::Permission);
        LocalFree(string.cast());
        result
    }
}
pub(crate) struct Descriptor(pub(crate) PSECURITY_DESCRIPTOR);
impl Drop for Descriptor {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0);
        }
    }
}
pub(crate) fn descriptor() -> Result<Descriptor> {
    let sid = user_sid()?;
    let sddl = wide(std::ffi::OsStr::new(&format!(
        "O:{sid}D:P(A;OICI;FA;;;{sid})"
    )));
    unsafe {
        let mut raw = ptr::null_mut();
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            SDDL_REVISION_1,
            &mut raw,
            ptr::null_mut(),
        ) == 0
        {
            return Err(Error::Permission);
        }
        Ok(Descriptor(raw))
    }
}

pub fn check_private(path: &Path) -> Result<()> {
    paths::no_reparse(path)?;
    let expected = user_sid()?;
    unsafe {
        let mut owner = ptr::null_mut();
        let mut dacl = ptr::null_mut();
        let mut raw = ptr::null_mut();
        let name = wide(path.as_os_str());
        if GetNamedSecurityInfoW(
            name.as_ptr(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            ptr::null_mut(),
            &mut dacl,
            ptr::null_mut(),
            &mut raw,
        ) != ERROR_SUCCESS
        {
            return Err(Error::Permission);
        }
        let _descriptor = Descriptor(raw);
        if owner.is_null()
            || dacl.is_null()
            || sid_string(owner)? != expected
            || (*dacl).AceCount != 1
        {
            return Err(Error::Permission);
        }
        let mut ace: *mut c_void = ptr::null_mut();
        if GetAce(dacl, 0, &mut ace) == 0 || ace.is_null() {
            return Err(Error::Permission);
        }
        let allowed = &*ace.cast::<ACCESS_ALLOWED_ACE>();
        if u32::from(allowed.Header.AceType) != ACCESS_ALLOWED_ACE_TYPE
            || allowed.Mask & FILE_ALL_ACCESS != FILE_ALL_ACCESS
            || sid_string(ptr::addr_of!(allowed.SidStart).cast_mut().cast())? != expected
        {
            return Err(Error::Permission);
        }
    }
    Ok(())
}

pub fn private_directory(path: &Path) -> Result<()> {
    paths::no_reparse(path)?;
    if path.exists() {
        check_private(path)?;
        return if path.is_dir() {
            Ok(())
        } else {
            Err(Error::InvalidPath)
        };
    }
    let parent = path.parent().ok_or(Error::InvalidPath)?;
    if !parent.is_dir() {
        return Err(Error::Missing);
    }
    let desc = descriptor()?;
    let attributes = SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: desc.0,
        bInheritHandle: 0,
    };
    unsafe {
        if CreateDirectoryW(wide(path.as_os_str()).as_ptr(), &attributes) == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
    }
    check_private(path)
}

pub fn private_file(path: &Path, bytes: &[u8]) -> Result<()> {
    paths::no_reparse(path)?;
    let desc = descriptor()?;
    let attributes = SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: desc.0,
        bInheritHandle: 0,
    };
    unsafe {
        let raw = CreateFileW(
            wide(path.as_os_str()).as_ptr(),
            GENERIC_WRITE,
            0,
            &attributes,
            CREATE_NEW,
            FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT,
            ptr::null_mut(),
        );
        if raw == INVALID_HANDLE_VALUE {
            return Err(std::io::Error::last_os_error().into());
        }
        let mut file = File::from_raw_handle(raw);
        let written = file.write_all(bytes).and_then(|_| file.sync_all());
        drop(file);
        if let Err(e) = written {
            // Only the exact CREATE_NEW file belongs to this failed write.
            paths::no_reparse(path)?;
            std::fs::remove_file(path).map_err(|_| Error::Cleanup)?;
            return Err(e.into());
        }
    }
    check_private(path)
}

pub fn replace(source: &Path, destination: &Path) -> Result<()> {
    paths::no_reparse(source)?;
    paths::no_reparse(destination)?;
    unsafe {
        let result = if destination.exists() {
            ReplaceFileW(
                wide(destination.as_os_str()).as_ptr(),
                wide(source.as_os_str()).as_ptr(),
                ptr::null(),
                0,
                ptr::null(),
                ptr::null(),
            )
        } else {
            MoveFileExW(
                wide(source.as_os_str()).as_ptr(),
                wide(destination.as_os_str()).as_ptr(),
                MOVEFILE_WRITE_THROUGH,
            )
        };
        if result == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
    }
    Ok(())
}

pub struct Lock(Handle);
impl Lock {
    pub fn acquire(identity: &str) -> Result<Self> {
        let name = format!(
            "Global\\FenneviaInstaller-{}",
            paths::hash(identity.as_bytes())
        );
        unsafe {
            let raw = CreateMutexW(ptr::null(), 0, wide(std::ffi::OsStr::new(&name)).as_ptr());
            if raw.is_null() {
                return Err(Error::Permission);
            }
            let handle = Handle(raw);
            match WaitForSingleObject(raw, 0) {
                WAIT_OBJECT_0 | WAIT_ABANDONED => Ok(Self(handle)),
                WAIT_TIMEOUT => Err(Error::Busy),
                _ => Err(Error::Permission),
            }
        }
    }
}
impl Drop for Lock {
    fn drop(&mut self) {
        unsafe {
            ReleaseMutex(self.0.0);
        }
    }
}
