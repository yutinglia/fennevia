// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{Error, Result};
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings8;
use windows_core::Interface;

pub fn configure(webview: tauri::webview::PlatformWebview) -> Result<()> {
    // Called on the UI thread while the only document is about:blank.
    let configure = || -> windows_core::Result<()> {
        unsafe {
            let settings = webview
                .controller()
                .CoreWebView2()?
                .Settings()?
                .cast::<ICoreWebView2Settings8>()?;
            settings.SetIsReputationCheckingRequired(false)?;
            settings.SetIsGeneralAutofillEnabled(false)?;
            settings.SetIsPasswordAutosaveEnabled(false)?;
        }
        Ok(())
    };
    configure().map_err(|_| Error::Permission)
}

#[cfg(test)]
mod tests {
    #[test]
    fn runtime_options_disable_external_crash_uploads() {
        let options = webview2_com::CoreWebView2EnvironmentOptions::default();
        assert!(unsafe { options.is_custom_crash_reporting_enabled() });
    }
}
