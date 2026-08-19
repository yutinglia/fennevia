// SPDX-License-Identifier: MPL-2.0

using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            string packageRoot = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string script = Path.Combine(packageRoot, "scripts", "fennevia-gui.ps1");
            if (!File.Exists(script))
            {
                MessageBox.Show(
                    "Fennevia Setup could not find scripts\\fennevia-gui.ps1 in this extracted release.",
                    "Fennevia Setup",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            string powershell = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.System),
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe");
            if (!File.Exists(powershell))
            {
                MessageBox.Show(
                    "Windows PowerShell 5.1 was not found. Fennevia Setup cannot start.",
                    "Fennevia Setup",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            string extra = "";
            for (int i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], "--resume-state", StringComparison.Ordinal))
                {
                    if (i + 1 >= args.Length || string.IsNullOrWhiteSpace(args[i + 1]))
                    {
                        MessageBox.Show(
                            "The administrator resume argument is missing.",
                            "Fennevia Setup",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error);
                        return 1;
                    }

                    extra += " -ResumeStatePath " + Quote(args[i + 1]);
                    i++;
                    continue;
                }

                MessageBox.Show(
                    "An unsupported Fennevia Setup argument was provided.",
                    "Fennevia Setup",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = powershell;
            startInfo.Arguments = "-NoProfile -Sta -ExecutionPolicy Bypass -File "
                + Quote(script)
                + " -PackageRoot "
                + Quote(packageRoot)
                + extra;
            startInfo.WorkingDirectory = packageRoot;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;

            using (Process process = Process.Start(startInfo))
            {
                if (process == null)
                {
                    MessageBox.Show(
                        "Windows PowerShell did not start Fennevia Setup.",
                        "Fennevia Setup",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    return 1;
                }

                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception)
        {
            MessageBox.Show(
                "Fennevia Setup failed before the wizard could open.",
                "Fennevia Setup",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string Quote(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "\"\"";
        }

        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
